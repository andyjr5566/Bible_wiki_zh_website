"""Build the props used by the Numbers 2 camp site and export them as GLB.

Run inside Blender (e.g. through the MCP socket: ``python send.py build_camp.py``).
The script works in its own scene ("num2_camp") and never touches anything else that is
open in Blender. Units are cubits (1 Blender unit = 1 cubit). Blender +X = east, +Y = north;
after export (glTF is Y-up) north is -Z.

Scripture-given facts used here:
  - 篷子車 wagons: 2 for Gershon (4 oxen), 4 for Merari (8 oxen), none for Kohath  (民7:3-9)
  - 哥轄人抬的聖物：約櫃 (outer: 純藍色毯子)，桌子、燈臺、金壇、燔祭壇 (outer: 海狗皮)，
    each carried on poles                                                         (民4:5-14)
Everything else (wagon shape, wrapping shape, ropes, proportions) is an illustrative
reconstruction and is labelled as such in the UI.

Outputs (public/models/):
  wagon.glb  one covered ox-cart, tongue pointing +X
  loads.glb  five carried loads: load_ark, load_table, load_lampstand, load_incense, load_altar
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT_DIR = os.environ.get("NUM2_OUT") or r"C:\Obsidian\Hermes\scripture\appendix\website\民數記\第2章\public\models"
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------- own scene
orig_scene = next((s for s in bpy.data.scenes if s.name != "num2_camp"), None)
old = bpy.data.scenes.get("num2_camp")
if old:
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("num2_camp")
if bpy.context.window:
    bpy.context.window.scene = sc


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def mat(name, color, metallic=0.0, rough=0.7, double=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    m.use_backface_culling = not double
    return m


WOOD = mat("n2_wood", "#8a5a35", 0.0, 0.75)
WOOD_DK = mat("n2_wood_dark", "#5a3a22", 0.0, 0.8)
CLOTH = mat("n2_canopy_cloth", "#e6dcc4", 0.0, 0.92, double=True)
IRON = mat("n2_iron", "#3d3d40", 0.6, 0.5)
BLUE = mat("n2_blue_cloth", "#2a4fa8", 0.0, 0.92, double=True)
SEAL = mat("n2_sealskin", "#4b4037", 0.0, 0.7, double=True)
ROPE = mat("n2_rope", "#b59c6a", 0.0, 0.95)


class Prop:
    """Collects geometry per material and turns each material group into one mesh object under an empty."""

    def __init__(self, name):
        self.name = name
        self.bms = {}

    def _bm(self, material):
        if material.name not in self.bms:
            self.bms[material.name] = (material, bmesh.new())
        return self.bms[material.name][1]

    @staticmethod
    def _M(center, rot=(0, 0, 0), scale=(1, 1, 1)):
        R = Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X")
        S = Matrix.Diagonal((*scale, 1.0))
        return Matrix.Translation(center) @ R @ S

    def box(self, material, size, center, rot=(0, 0, 0)):
        bm = self._bm(material)
        v = bmesh.ops.create_cube(bm, size=1.0)["verts"]
        bmesh.ops.transform(bm, matrix=self._M(center, rot, size), verts=v)

    def cyl(self, material, radius, depth, center, axis="z", seg=14, smooth=True):
        bm = self._bm(material)
        r = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=radius, radius2=radius, depth=depth)
        rot = {"z": (0, 0, 0), "x": (0, math.pi / 2, 0), "y": (math.pi / 2, 0, 0)}[axis]
        bmesh.ops.transform(bm, matrix=self._M(center, rot), verts=r["verts"])
        if smooth:
            for f in {f for v in r["verts"] for f in v.link_faces}:
                f.smooth = True

    def arch(self, material, radius, length, center, seg=14, thickness=0.0):
        """Half-pipe roof running along X, open below; center is the axis on the ground plane."""
        bm = self._bm(material)
        pts = []
        for i in range(seg + 1):
            a = math.pi * i / seg
            pts.append((math.cos(a) * radius, math.sin(a) * radius))
        rings = []
        for x in (-length / 2, length / 2):
            rings.append([bm.verts.new(Vector((center[0] + x, center[1] + py, center[2] + pz))) for py, pz in pts])
        for i in range(seg):
            f = bm.faces.new((rings[0][i], rings[0][i + 1], rings[1][i + 1], rings[1][i]))
            f.smooth = True

    def build(self, parent_loc=(0, 0, 0)):
        root = bpy.data.objects.new(self.name, None)
        sc.collection.objects.link(root)
        root.location = parent_loc
        for material, bm in self.bms.values():
            bm.normal_update()
            me = bpy.data.meshes.new(f"{self.name}_{material.name}")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(material)
            ob = bpy.data.objects.new(f"{self.name}__{material.name}", me)
            sc.collection.objects.link(ob)
            ob.parent = root
        return root


def export(objects, filename):
    for ob in sc.objects:
        ob.select_set(False)
    for root in objects:
        root.select_set(True)
        for ch in root.children_recursive:
            ch.select_set(True)
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_active_scene=True, use_selection=True, export_apply=True,
                              export_yup=True, export_materials="EXPORT")
    print("exported", path, os.path.getsize(path), "bytes")


# ================================================================ wagon (篷子車)
def make_wagon():
    p = Prop("wagon")
    # 車身：底板、兩側欄
    p.box(WOOD, (4.4, 2.5, 0.22), (0, 0, 1.35))
    for sy in (-1, 1):
        p.box(WOOD_DK, (4.4, 0.14, 0.5), (0, sy * 1.18, 1.7))
    p.box(WOOD_DK, (0.14, 2.5, 0.5), (-2.15, 0, 1.7))
    # 兩個實心木輪
    for sy in (-1, 1):
        p.cyl(WOOD_DK, 1.0, 0.22, (0.0, sy * 1.45, 1.0), axis="y", seg=20)
        p.cyl(IRON, 0.22, 0.34, (0.0, sy * 1.45, 1.0), axis="y", seg=10)
    p.cyl(IRON, 0.1, 3.3, (0.0, 0, 1.0), axis="y", seg=8)  # 車軸
    # 車轅與軛（牛在前面，朝 +X）
    p.box(WOOD_DK, (3.4, 0.2, 0.2), (3.6, 0, 1.05))
    p.box(WOOD_DK, (0.2, 2.0, 0.2), (5.2, 0, 1.15))
    for sy in (-0.5, 0.5):
        p.box(WOOD, (0.14, 0.14, 0.9), (5.2, sy * 1.6 * 0.5 + sy * 0.3, 0.75))
    # 篷：拱形骨架＋布
    for x in (-1.8, -0.9, 0.0, 0.9, 1.8):
        p.arch(WOOD_DK, 1.15, 0.12, (x, 0, 1.46), seg=12)
    p.arch(CLOTH, 1.2, 4.3, (0, 0, 1.46), seg=14)
    return p.build()


# ================================================================ loads (哥轄人抬的聖物，民4:5-14)
SHOULDER = 3.1  # 抬槓離地高度（肘），約在人的肩上


def poles(p, length, spread, z=SHOULDER):
    for sy in (-1, 1):
        p.cyl(WOOD, 0.09, length, (0, sy * spread, z), axis="x", seg=8)


def straps(p, positions, size, z):
    for x in positions:
        p.box(ROPE, (0.09, size[0] + 0.06, size[1] + 0.06), (x, 0, z))


def load_ark():
    p = Prop("load_ark")
    poles(p, 4.6, 0.95)
    # 約櫃長 2.5、寬 1.5、高 1.5；最外面是純藍色的毯子
    p.box(BLUE, (2.6, 1.6, 1.6), (0, 0, SHOULDER + 0.09 + 0.8))
    p.box(BLUE, (2.7, 1.2, 0.18), (0, 0, SHOULDER + 0.09 + 1.65))  # 毯子垂邊
    straps(p, (-0.7, 0.7), (1.6, 1.6), SHOULDER + 0.89)
    return p.build()


def load_table():
    p = Prop("load_table")
    poles(p, 4.0, 0.65)
    # 桌子長 2、寬 1、高 1.5；最外面是海狗皮
    p.box(SEAL, (2.1, 1.1, 1.6), (0, 0, SHOULDER + 0.09 + 0.8))
    straps(p, (-0.55, 0.55), (1.1, 1.6), SHOULDER + 0.89)
    return p.build()


def load_lampstand():
    p = Prop("load_lampstand")
    # 燈臺和器具包在海狗皮裡，放在抬架上
    poles(p, 4.0, 0.6)
    p.box(WOOD_DK, (2.6, 1.6, 0.14), (0, 0, SHOULDER + 0.09 + 0.07))  # 抬架
    p.cyl(SEAL, 0.62, 2.5, (0, 0, SHOULDER + 0.09 + 0.14 + 0.62), axis="x", seg=14)
    straps(p, (-0.7, 0.0, 0.7), (1.24, 1.24), SHOULDER + 0.85)
    return p.build()


def load_incense():
    p = Prop("load_incense")
    poles(p, 3.6, 0.6)
    # 金壇長寬各 1、高 2；藍色毯子上再蒙海狗皮
    p.box(SEAL, (1.1, 1.1, 2.1), (0, 0, SHOULDER + 0.09 + 1.05))
    straps(p, (0.0,), (1.1, 2.1), SHOULDER + 1.1)
    return p.build()


def load_altar():
    p = Prop("load_altar")
    poles(p, 7.0, 2.1)
    # 燔祭壇 5×5×3；紫色毯子鋪在壇上，最外面蒙海狗皮
    p.box(SEAL, (5.1, 5.1, 3.1), (0, 0, SHOULDER + 0.09 + 1.55))
    straps(p, (-1.6, 0.0, 1.6), (5.1, 3.1), SHOULDER + 1.6)
    return p.build()


wagon = make_wagon()
export([wagon], "wagon.glb")

# 五件聖物並排放（各自原點在地面）；three.js 端依名稱取用
roots = []
for i, fn in enumerate((load_ark, load_table, load_lampstand, load_incense, load_altar)):
    r = fn()
    r.location = (0, i * 9.0, 0)
    roots.append(r)
export(roots, "loads.glb")

print("scene objects:", len(sc.objects), "| original scene:", orig_scene.name if orig_scene else None)
