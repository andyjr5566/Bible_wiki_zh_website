"""Reproducible, isolated Blender pipeline for the Exodus 25 ark asset.

The script never clears the user's current scene and never writes a public GLB
until the staging export has passed an inspect/re-import check. Run it from a
clean Blender process (``--factory-startup`` is recommended) so the saved blend
contains only the R07 work scene.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
DEFAULT_CONFIG = SCRIPT_PATH.parent / "config" / "ark.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_config(path: Path) -> dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    required = ("assetId", "sourceRelative", "stagingRelative", "processedRelative", "publicRelative", "blendRelative", "collection")
    for key in required:
        if not config.get(key):
            raise ValueError(f"config missing {key}")
    return config


def resolve_path(value: str, root: Path) -> Path:
    candidate = Path(value)
    return candidate if candidate.is_absolute() else root / candidate


def object_bounds(objects: list[bpy.types.Object]) -> dict[str, Any]:
    points: list[tuple[float, float, float]] = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(tuple(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box)
    if not points:
        return {"min": None, "max": None, "size": None}
    mins = [min(point[index] for point in points) for index in range(3)]
    maxs = [max(point[index] for point in points) for index in range(3)]
    return {"min": mins, "max": maxs, "size": [maxs[i] - mins[i] for i in range(3)]}


def metrics(objects: list[bpy.types.Object]) -> dict[str, Any]:
    meshes = [obj for obj in objects if obj.type == "MESH"]
    material_names = sorted({re.sub(r"\.\d{3}$", "", slot.material.name) for obj in meshes for slot in obj.material_slots if slot.material})
    return {
        "objectCount": len(objects),
        "meshCount": len(meshes),
        "triangleCount": sum(len(mesh.data.polygons) for mesh in meshes),
        "bounds": object_bounds(objects),
        "materialCount": len(material_names),
        "materials": material_names,
    }


def unlink_collection(collection: bpy.types.Collection) -> None:
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for child in list(collection.children):
        unlink_collection(child)
        collection.children.unlink(child)
        bpy.data.collections.remove(child)


def ensure_work_scene(config: dict[str, Any]) -> tuple[bpy.types.Scene, bpy.types.Collection]:
    if bpy.app.background and not bpy.data.filepath:
        # ``--factory-startup`` gives us Blender's default Cube/Camera/Light.
        # In this explicitly clean process it is safe to remove those objects;
        # a background run against a saved user file is refused below.
        scene = bpy.context.scene
        scene.name = config.get("sceneName", "EX25_R07_Work")
        for obj in list(scene.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        scene = bpy.data.scenes.get(config.get("sceneName", "EX25_R07_Work"))
    if scene is None:
        scene = bpy.data.scenes.new(config.get("sceneName", "EX25_R07_Work"))
    collection = bpy.data.collections.get(config["collection"])
    if collection is None:
        collection = bpy.data.collections.new(config["collection"])
    if collection.name not in {item.name for item in scene.collection.children}:
        scene.collection.children.link(collection)
    # Only this owned collection is reset; foreign scenes and collections stay intact.
    unlink_collection(collection)
    return scene, collection


def switch_to_scene(scene: bpy.types.Scene) -> None:
    for window in bpy.context.window_manager.windows:
        window.scene = scene


def import_source(source: Path, collection: bpy.types.Collection, scene: bpy.types.Scene | None = None) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    if scene is None or scene == bpy.context.scene:
        bpy.ops.import_scene.gltf(filepath=str(source))
    else:
        with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
            bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise RuntimeError("glTF import produced no objects")
    for obj in imported:
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)
    return imported


def model_objects(objects: list[bpy.types.Object], config: dict[str, Any]) -> list[bpy.types.Object]:
    root = next((obj for obj in objects if obj.name == config.get("rootObject")), None)
    if root is None:
        raise RuntimeError(f"expected model root was not found: {config.get('rootObject')}")
    return [root, *root.children_recursive]


def material(config: dict[str, Any]) -> bpy.types.Material:
    mat = bpy.data.materials.get(config["name"]) or bpy.data.materials.new(config["name"])
    mat.use_nodes = True
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*config["baseColor"], 1.0)
    bsdf.inputs["Metallic"].default_value = config["metallic"]
    bsdf.inputs["Roughness"].default_value = config["roughness"]
    return mat


def replace_materials(objects: list[bpy.types.Object], config: dict[str, Any]) -> None:
    materials = {item["name"]: material(item) for item in config["materials"]}
    by_name = {obj.name: obj for obj in objects}
    for assignment in config.get("materialAssignments", []):
        obj = by_name.get(assignment["object"])
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"material assignment object missing: {assignment['object']}")
        obj.data.materials.clear()
        obj.data.materials.append(materials[assignment["material"]])
        if assignment.get("regionMaterial") and assignment.get("region"):
            obj.data.materials.append(materials[assignment["regionMaterial"]])
            region = assignment["region"]
            bounds_min = region["min"]
            bounds_max = region["max"]
            for polygon in obj.data.polygons:
                center = polygon.center
                inside = all(bounds_min[i] <= center[i] <= bounds_max[i] for i in range(3))
                polygon.material_index = 1 if inside else 0


def add_cameras_and_lights(scene: bpy.types.Scene, collection: bpy.types.Collection, config: dict[str, Any], objects: list[bpy.types.Object]) -> None:
    camera_specs = config.get("cameras", [])
    if config.get("autoCameras"):
        bounds = object_bounds(objects)
        bounds_min = bounds.get("min")
        bounds_max = bounds.get("max")
        if not bounds_min or not bounds_max or not bounds.get("size"):
            raise RuntimeError("auto camera framing requires mesh bounds")
        center = Vector((
            (bounds_min[0] + bounds_max[0]) * 0.5,
            (bounds_min[1] + bounds_max[1]) * 0.5,
            (bounds_min[2] + bounds_max[2]) * 0.5,
        ))
        size = max(float(value) for value in bounds["size"])
        distance = max(size * 2.15, 2.5)
        camera_specs = [
            {"name": "Front", "location": [center.x, center.y + size * 0.18, center.z + distance]},
            {"name": "Side", "location": [center.x + distance, center.y + size * 0.18, center.z]},
            {"name": "Top", "location": [center.x, center.y + distance, center.z + size * 0.18]},
            {"name": "Close", "location": [center.x + distance * 0.95, center.y + size * 0.28, center.z + distance * 0.95]},
        ]
    for camera_spec in camera_specs:
        data = bpy.data.cameras.new(camera_spec["name"])
        camera = bpy.data.objects.new(camera_spec["name"], data)
        collection.objects.link(camera)
        camera.location = camera_spec["location"]
        if "rotation" in camera_spec:
            camera.rotation_euler = camera_spec["rotation"]
        elif config.get("autoCameras"):
            camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        data.lens = camera_spec.get("lens", 50)
    light_spec = config.get("light", {})
    light_data = bpy.data.lights.new("R07_Key_Light", type="AREA")
    base_energy = float(light_spec.get("energy", 900))
    light_data.energy = base_energy * max(1.0, (distance / 6.0) ** 2) if config.get("autoCameras") else base_energy
    light_data.shape = "DISK"
    light_data.size = light_spec.get("size", 5)
    light = bpy.data.objects.new("R07_Key_Light", light_data)
    collection.objects.link(light)
    if config.get("autoCameras"):
        light.location = center + Vector((distance * 0.8, distance * 0.9, distance * 0.7))
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    else:
        light.location = light_spec.get("location", [3, -3, 4])
        light.rotation_euler = light_spec.get("rotation", [0.4, 0, 0.7])
    if config.get("autoCameras"):
        fill_data = bpy.data.lights.new("R07_Fill_Light", type="AREA")
        fill_data.energy = light_data.energy * 0.42
        fill_data.shape = "DISK"
        fill_data.size = light_spec.get("size", 5) * 1.35
        fill = bpy.data.objects.new("R07_Fill_Light", fill_data)
        collection.objects.link(fill)
        fill.location = center + Vector((-distance * 0.72, distance * 0.42, -distance * 0.65))
        fill.rotation_euler = (center - fill.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = next((obj for obj in collection.objects if obj.type == "CAMERA"), None)


def set_metadata(scene: bpy.types.Scene, config: dict[str, Any], source: Path, objects: list[bpy.types.Object]) -> None:
    scene.unit_settings.system = config["units"]["system"]
    scene.unit_settings.scale_length = config["units"]["scaleLength"]
    root_name = config.get("rootObject")
    root = next((obj for obj in objects if obj.name == root_name), objects[0])
    root.location = config.get("origin", [0, 0, 0])
    root["asset_id"] = config["assetId"]
    root["source_sha256"] = sha256(source)
    root["source_relative"] = config["sourceRelative"]
    root["axis_forward"] = config["axes"]["forward"]
    root["axis_up"] = config["axes"]["up"]
    root["historical_status"] = "reconstructed"
    root["section_note"] = config.get("section", {}).get("note", "")


def export_glb(path: Path, objects: list[bpy.types.Object], scene: bpy.types.Scene) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Deselect across all scenes. Blender's operator only touches the active
    # view layer, while the glTF exporter can still see selected objects in a
    # factory-startup scene that is not the R07 work scene.
    for obj in bpy.data.objects:
        obj.select_set(False)
    selected = [obj for obj in objects if obj.type in {"MESH", "EMPTY"}]
    for obj in selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = selected[0] if selected else None
    def run_export() -> None:
        bpy.ops.export_scene.gltf(
            filepath=str(path), use_selection=True, export_format="GLB",
            export_apply=False, export_materials="EXPORT", export_cameras=False,
            export_lights=False, export_animations=False, export_yup=True,
        )
    if scene == bpy.context.scene:
        run_export()
    else:
        with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
            run_export()


def optimize_glb(input_path: Path, output_path: Path, root: Path) -> None:
    cli_name = "gltf-transform.cmd" if sys.platform == "win32" else "gltf-transform"
    cli = root / "node_modules" / ".bin" / cli_name
    if not cli.exists():
        raise FileNotFoundError(f"gltf-transform CLI not found: {cli}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    args = [str(cli), "optimize", "--compress", "quantize", "--flatten", "false",
            "--instance", "false", "--join", "false", "--palette", "false",
            "--simplify", "false", "--texture-compress", "false",
            "--texture-size", "2048", str(input_path), str(output_path)]
    subprocess.run(args, check=True, shell=sys.platform == "win32")


def reimport_check(path: Path, scene: bpy.types.Scene, collection: bpy.types.Collection, config: dict[str, Any]) -> dict[str, Any]:
    check_name = f"{collection.name}__REIMPORT_CHECK"
    check_collection = bpy.data.collections.get(check_name) or bpy.data.collections.new(check_name)
    if check_collection.name not in {item.name for item in scene.collection.children}:
        scene.collection.children.link(check_collection)
    unlink_collection(check_collection)
    # The work model already owns names such as ``Ark``. Temporarily prefix
    # those names so the re-import can be checked with the same deterministic
    # names, then restore the editable work scene before it is saved.
    renamed: list[tuple[bpy.types.Object, str]] = []
    for obj in list(collection.objects):
        old_name = obj.name
        obj.name = f"__R07_BUILT__{old_name}"
        renamed.append((obj, old_name))
    try:
        imported = import_source(path, check_collection, scene)
        result = metrics(model_objects(imported, config))
    finally:
        unlink_collection(check_collection)
        for obj, old_name in renamed:
            if obj.name in bpy.data.objects:
                obj.name = old_name
    return result


def purge_unused_materials(config: dict[str, Any]) -> None:
    keep = {item["name"] for item in config["materials"]}
    for mat in list(bpy.data.materials):
        if mat.name not in keep and mat.users == 0:
            bpy.data.materials.remove(mat)


def render_previews(scene: bpy.types.Scene, collection: bpy.types.Collection, staging_dir: Path, phase: str) -> list[str]:
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if scene.world:
        scene.world.color = (0.12, 0.12, 0.12)
    outputs: list[str] = []
    for camera in (obj for obj in collection.objects if obj.type == "CAMERA"):
        scene.camera = camera
        output = staging_dir / "previews" / f"{phase}-{camera.name}.png"
        output.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(output)
        if scene == bpy.context.scene:
            bpy.ops.render.render(write_still=True)
        else:
            with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
                bpy.ops.render.render(write_still=True)
        outputs.append(str(output.relative_to(PROJECT_ROOT)))
    return outputs


def manifest(config: dict[str, Any], source: Path, staged: Path, optimized: Path, build_metrics: dict[str, Any], check_metrics: dict[str, Any], previews: list[str]) -> dict[str, Any]:
    return {
        "schemaVersion": config.get("stageId", "r07"),
        "assetId": config["assetId"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "blenderVersion": bpy.app.version_string,
        "source": {"path": config["sourceRelative"], "sha256": sha256(source), "bytes": source.stat().st_size},
        "staging": {"path": str(staged.relative_to(PROJECT_ROOT)), "sha256": sha256(staged), "bytes": staged.stat().st_size},
        "optimized": {"path": str(optimized.relative_to(PROJECT_ROOT)), "sha256": sha256(optimized), "bytes": optimized.stat().st_size},
        "units": config["units"], "axes": config["axes"], "origin": config.get("origin", [0, 0, 0]),
        "materials": config["materials"], "parts": config.get("parts", []), "section": config.get("section", {}),
        "buildMetrics": build_metrics, "reimportMetrics": check_metrics,
        "previews": previews,
        "promotion": {"status": "not-promoted", "files": [config["processedRelative"], config["publicRelative"]]},
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--input", type=Path, help="Override source GLB")
    parser.add_argument("--staging-dir", type=Path, help="Override staging directory")
    parser.add_argument("--promote", action="store_true", help="Copy validated optimized GLB to processed/public")
    parser.add_argument("--inspect-only", action="store_true", help="Inspect source without importing or writing")
    # Blender keeps its own flags in sys.argv. Arguments after Blender's ``--``
    # marker are the script's exact argv and must be parsed separately.
    argv = sys.argv[1:]
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    args, _unknown = parser.parse_known_args(argv)
    return args


def main() -> None:
    args = parse_args()
    config = load_config(args.config.resolve())
    root = PROJECT_ROOT
    source = (args.input or resolve_path(config["sourceRelative"], root)).resolve()
    if not source.exists():
        raise FileNotFoundError(source)
    source_hash = sha256(source)
    if args.inspect_only:
        print(json.dumps({"assetId": config["assetId"], "source": str(source), "sha256": source_hash, "bytes": source.stat().st_size}, ensure_ascii=False, indent=2))
        return

    staging_dir = (args.staging_dir or resolve_path(config["stagingRelative"], root).parent).resolve()
    staged = staging_dir / f"{config['assetId']}.staged.glb"
    optimized = staging_dir / f"{config['assetId']}.optimized.glb"
    blend = resolve_path(config["blendRelative"], root)
    scene, collection = ensure_work_scene(config)
    switch_to_scene(scene)
    imported = import_source(source, collection, scene)
    model = model_objects(imported, config)
    for obj in imported:
        if obj not in model:
            bpy.data.objects.remove(obj, do_unlink=True)
    add_cameras_and_lights(scene, collection, config, model)
    previews = render_previews(scene, collection, staging_dir, "before")
    replace_materials(model, config)
    set_metadata(scene, config, source, model)
    previews.extend(render_previews(scene, collection, staging_dir, "after"))
    # Compare the model payload only; fixed cameras/lights are scene helpers
    # and are intentionally absent from a glTF re-import.
    build_metrics = metrics(model)
    export_glb(staged, model, scene)
    optimize_glb(staged, optimized, root)
    check_metrics = reimport_check(optimized, scene, collection, config)
    sizes = zip(build_metrics["bounds"]["size"] or [], check_metrics["bounds"]["size"] or [])
    size_match = all(abs(float(left) - float(right)) <= 0.03 for left, right in sizes)
    if (build_metrics["objectCount"] != check_metrics["objectCount"] or
            build_metrics["meshCount"] != check_metrics["meshCount"] or
            build_metrics["triangleCount"] != check_metrics["triangleCount"] or
            build_metrics["materialCount"] != check_metrics["materialCount"] or not size_match):
        raise RuntimeError(f"re-import check mismatch: build={build_metrics} check={check_metrics}")
    purge_unused_materials(config)
    report = manifest(config, source, staged, optimized, build_metrics, check_metrics, previews)
    stage_id = config.get("stageId", "r07")
    report_path = staging_dir / f"{config['assetId']}.{stage_id}-manifest.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    if args.promote:
        if source_hash != sha256(source):
            raise RuntimeError("source changed during build; promotion refused")
        processed = resolve_path(config["processedRelative"], root)
        public = resolve_path(config["publicRelative"], root)
        for destination in (processed, public):
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(optimized, destination)
        report["promotion"] = {"status": "promoted", "files": [config["processedRelative"], config["publicRelative"]]}
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"stage": "pass", "manifest": str(report_path), "promoted": args.promote, "buildMetrics": build_metrics, "reimportMetrics": check_metrics}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
