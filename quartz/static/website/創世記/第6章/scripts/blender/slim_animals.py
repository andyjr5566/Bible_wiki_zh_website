"""Slim the downloaded animal models: keep Walk / Idle / Eat clips, shrink textures.

Sources (see src/data/credits.ts): Quaternius animated animals (CC0) and
Poly by Google animals (CC-BY 3.0), both downloaded from poly.pizza.
Env: ANIMALS_IN (folder of raw .glb), ANIMALS_OUT (public/models/animals).
"""
import os

import bpy

SRC = os.environ.get("ANIMALS_IN") or r"C:\Users\ANDYJ_~1\AppData\Local\Temp\claude\c--Obsidian-Hermes-scripture\9d0ef271-87ff-4044-9cad-2a12e9ca1157\scratchpad\pp\glb"
DST = os.environ.get("ANIMALS_OUT") or r"C:\Obsidian\Hermes\scripture\appendix\website\創世記\第6章\public\models\animals"
KEEP = {"Walk": ("Walk",), "Idle": ("Idle",), "Eat": ("Eating", "Idle_Eating", "Idle_Headlow", "Idle_Peck")}
NAMES = ["horse", "horse_w", "donkey", "cow", "bull", "sheep", "deer", "stag", "wolf", "fox", "alpaca", "pig",
         "chicken", "elephant", "giraffe", "lion", "camel"]
os.makedirs(DST, exist_ok=True)
if os.environ.get("ANIMALS_ONLY"):
    NAMES = os.environ["ANIMALS_ONLY"].split(",")


def purge():
    """Drop every slim_* scene and every action/armature data left from earlier runs,
    otherwise the ACTIONS exporter attaches other animals' clips to this one."""
    for sc in [s for s in bpy.data.scenes if s.name.startswith("slim_")]:
        for o in list(sc.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(sc)
    for a in list(bpy.data.actions):
        if a.users == 0 or a.use_fake_user or a.name.split("|")[-1] in {"Walk", "Idle", "Eat"} or "Armature" in a.name:
            a.use_fake_user = False
            bpy.data.actions.remove(a)
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


for name in NAMES:
    purge()
    scn_name = f"slim_{name}"
    old = bpy.data.scenes.get(scn_name)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    scn = bpy.data.scenes.new(scn_name)
    bpy.context.window.scene = scn
    before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + ".glb"))
    acts = [a for a in bpy.data.actions if a not in before]
    chosen = {}
    for label, suffixes in KEEP.items():
        for suf in suffixes:
            cands = [a for a in acts if a.name.split("|")[-1] == suf]
            if cands:
                # prefer the shortest name (the unprefixed duplicate)
                chosen[label] = sorted(cands, key=lambda a: len(a.name))[0]
                break
    for a in acts:
        if a not in chosen.values():
            bpy.data.actions.remove(a)
    for label, a in chosen.items():
        a.name = label
        a.use_fake_user = True
    arm = next((o for o in scn.objects if o.type == "ARMATURE"), None)
    if arm and "Idle" in chosen:
        arm.animation_data_create()
        arm.animation_data.action = chosen["Idle"]
    for img in {i for o in scn.objects if o.type == "MESH" for m in o.data.materials if m and m.node_tree for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image for i in [n.image]}:
        if max(img.size) > 512:
            img.scale(512, 512)
    for o in scn.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(scn.objects))
    out = os.path.join(DST, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True,
                              export_animations=bool(chosen), export_animation_mode="ACTIONS",
                              export_image_format="JPEG" if not arm else "AUTO", export_materials="EXPORT")
    print(name, sorted(chosen), os.path.getsize(out))
purge()
