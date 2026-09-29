"""Build the stylised tabernacle courtyard used by the site and export it as GLB.

Run inside Blender (e.g. through the MCP socket: ``python send.py build_courtyard.py``).
Units are cubits (1 Blender unit = 1 cubit). Blender +X = east, +Y = north.

Scripture-given dimensions (raw_scripture/出埃及記):
  - 燔祭壇 5×5×3, four horns, bronze grating to half height, poles  (出27:1-8)
  - 院子 100×50, curtains 5 high, gate screen 20 on the east      (出27:9-18)
  - 香壇 1×1×2, horns, gold rim, poles                             (出30:1-5)
  - 洗濯盆 between tent and altar (no size given → illustrative)    (出30:18, 40:7)
  - 幔子 separates 聖所 / 至聖所 on four pillars                   (出26:31-33)
Everything else (tent 30×10×10 from the board count, placements) is an
illustrative reconstruction and is labelled as such in the UI.
"""
import math
import os

import bmesh
import bpy

OUT = os.environ.get("COURTYARD_OUT") or r"C:\Obsidian\Hermes\scripture\appendix\website\利未記\第1章\public\models\courtyard.glb"

# ---------------------------------------------------------------- reset scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.collections):
    for item in list(block):
        if item.users == 0:
            block.remove(item)


def mat(name, color, metallic=0.0, rough=0.6, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nodes if n.type == "OUTPUT_MATERIAL"), None) or nodes.new("ShaderNodeOutputMaterial")
        m.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    return m


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


BRONZE = mat("bronze", srgb("#b0703a"), 0.9, 0.38)
BRONZE_DARK = mat("bronze_dark", srgb("#6e4526"), 0.85, 0.5)
GOLD = mat("gold", srgb("#d9ab3f"), 1.0, 0.28)
SILVER = mat("silver", srgb("#d6d9de"), 1.0, 0.3)
LINEN = mat("linen", srgb("#efe6d2"), 0.0, 0.92)
WOOD = mat("acacia", srgb("#8a5a35"), 0.0, 0.7)
COVER = mat("covering", srgb("#4a3a2e"), 0.0, 0.95)
RAMSKIN = mat("ramskin", srgb("#8c3b2e"), 0.0, 0.85)
ASH = mat("ash", srgb("#8d8a86"), 0.0, 1.0)
WATER = mat("water", srgb("#6fa7b8"), 0.0, 0.08)
GATE = mat("gate_weave", srgb("#ffffff"), 0.0, 0.85)   # textured at runtime
VEIL = mat("veil_weave", srgb("#ffffff"), 0.0, 0.85)   # textured at runtime


def link(obj, parent=None):
    if obj.name not in bpy.context.scene.collection.objects:
        pass
    if parent is not None:
        obj.parent = parent
    return obj


def box(name, size, loc, material, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier="bevel")
    o.data.materials.append(material)
    return link(o, parent)


def cyl(name, r, depth, loc, material, rot=(0, 0, 0), verts=16, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return link(o, parent)


def empty(name, loc=(0, 0, 0)):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    o = bpy.context.active_object
    o.name = name
    return o


def horn(name, loc, size, material, parent):
    """Tapered horn rising from a corner (出27:2 / 出30:2)."""
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=size * 0.72, radius2=size * 0.18,
                                    depth=size * 1.3, location=(loc[0], loc[1], loc[2] + size * 0.65),
                                    rotation=(0, 0, math.pi / 4))
    o = bpy.context.active_object
    o.name = name
    mod = o.modifiers.new("bevel", "BEVEL")
    mod.width = size * 0.08
    bpy.ops.object.modifier_apply(modifier="bevel")
    o.data.materials.append(material)
    return link(o, parent)


def lattice(name, width, height, loc, rot_z, material, parent, cells=10):
    """Bronze network (出27:4-5) as a wireframed grid."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=cells, y_subdivisions=max(3, cells // 2),
                                    size=1, location=loc, rotation=(math.pi / 2, 0, rot_z))
    o = bpy.context.active_object
    o.name = name
    o.scale = (width, height, 1)
    bpy.ops.object.transform_apply(scale=True, rotation=False)
    w = o.modifiers.new("wire", "WIREFRAME")
    w.thickness = 0.07
    bpy.ops.object.modifier_apply(modifier="wire")
    o.data.materials.append(material)
    return link(o, parent)


def set_origin(obj, loc):
    bpy.context.scene.cursor.location = loc
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)
    return obj


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


# ------------------------------------------------------------- 燔祭壇 (altar)
ALTAR_X = 18.0
parts = []
# lower body (net zone) and upper body separated by the ledge (圍腰板)
parts.append(box("altar_body", (5, 5, 3), (ALTAR_X, 0, 1.5), BRONZE, bevel=0.06))
parts.append(box("altar_ledge", (5.5, 5.5, 0.22), (ALTAR_X, 0, 1.55), BRONZE_DARK, bevel=0.03))
# top: hollow rim (壇是空的 出27:8)
parts.append(box("altar_top_inner", (4.3, 4.3, 0.2), (ALTAR_X, 0, 2.93), BRONZE_DARK))
for i, (dx, dy) in enumerate([(1, 1), (1, -1), (-1, 1), (-1, -1)]):
    parts.append(horn(f"altar_horn_{i}", (ALTAR_X + dx * 2.2, dy * 2.2, 3.0), 0.55, BRONZE, None))
for (dx, dy, rz) in [(0, 2.56, 0), (0, -2.56, 0), (2.56, 0, math.pi / 2), (-2.56, 0, math.pi / 2)]:
    parts.append(lattice("net", 5.0, 1.4, (ALTAR_X + dx, dy, 0.75), rz, BRONZE_DARK, None, cells=12))
for dy in (2.85, -2.85):
    parts.append(cyl("pole", 0.11, 8.0, (ALTAR_X, dy, 1.2), BRONZE_DARK, rot=(0, math.pi / 2, 0)))
    for dx in (1.8, -1.8):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.05, location=(ALTAR_X + dx, dy, 1.2),
                                         rotation=(0, math.pi / 2, 0))
        t = bpy.context.active_object
        t.data.materials.append(BRONZE)
        parts.append(t)
set_origin(join(parts, "altar"), (ALTAR_X, 0, 0))

# ash heap east of the altar (利1:16) and fire anchor
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(ALTAR_X + 5.2, 0, -0.55), segments=16, ring_count=8)
ash = bpy.context.active_object
ash.name = "ash_heap"
ash.scale = (1.2, 1.0, 0.8)
bpy.ops.object.transform_apply(scale=True)
ash.data.materials.append(ASH)
empty("anchor_fire", (ALTAR_X, 0, 3.0)).parent = None

# ------------------------------------------------------------ 洗濯盆 (laver)
LAVER_X = 2.0
bpy.ops.mesh.primitive_circle_add(vertices=24, radius=1, location=(0, 0, 0))
prof = bpy.context.active_object
bpy.ops.object.delete()
# lathe profile via bmesh spin
me = bpy.data.meshes.new("laver")
bm = bmesh.new()
profile = [(0.0, 0.0), (0.9, 0.0), (0.9, 0.12), (0.35, 0.3), (0.28, 1.2), (0.5, 1.45), (1.5, 1.7),
           (1.75, 2.35), (1.62, 2.4), (1.4, 1.95), (0.0, 1.85)]
verts = [bm.verts.new((x, 0, z)) for x, z in profile]
for a, b in zip(verts, verts[1:]):
    bm.edges.new((a, b))
bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=32)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
bm.to_mesh(me)
bm.free()
laver = bpy.data.objects.new("laver", me)
bpy.context.scene.collection.objects.link(laver)
laver.location = (LAVER_X, 0, 0)
me.materials.append(BRONZE)
for p in me.polygons:
    p.use_smooth = True
bpy.ops.mesh.primitive_circle_add(vertices=32, radius=1.55, fill_type="NGON", location=(LAVER_X, 0, 2.2))
water = bpy.context.active_object
water.name = "laver_water"
water.data.materials.append(WATER)


# ------------------------------------------------------ tent / 會幕 (illustrative)
TENT_W, TENT_E = -45.0, -15.0   # 30 cubits long; west end 5 cubits from court fence
VEIL_X = -35.0                  # 至聖所 10×10×10 at the west end
walls = []
walls.append(box("wall_n", (30, 0.5, 10), ((TENT_W + TENT_E) / 2, 5.25, 5), GOLD))
walls.append(box("wall_s", (30, 0.5, 10), ((TENT_W + TENT_E) / 2, -5.25, 5), GOLD))
walls.append(box("wall_w", (0.5, 11, 10), (TENT_W - 0.25, 0, 5), GOLD))
for i in range(21):   # board seams for texture of 20 boards per side (出26:18)
    x = TENT_W + i * 1.5
    for y in (5.52, -5.52):
        walls.append(box("seam", (0.05, 0.04, 10), (x, y, 5), mat("seam", srgb("#9b7428"), 1.0, 0.4)))
walls.append(box("floor", (30, 10, 0.1), ((TENT_W + TENT_E) / 2, 0, 0.05), mat("tent_floor", srgb("#b99a6b"), 0, 1)))
wall_mesh = join(walls, "tent_walls")

roof_parts = []
roof_parts.append(box("roof_red", (31.2, 12.2, 0.18), ((TENT_W + TENT_E) / 2 - 0.4, 0, 10.1), RAMSKIN))
roof_parts.append(box("roof_top", (32.0, 12.8, 0.14), ((TENT_W + TENT_E) / 2 - 0.4, 0, 10.26), COVER))
for y, s in ((6.3, 1), (-6.3, -1)):
    roof_parts.append(box("drape", (32.0, 0.14, 9.0), ((TENT_W + TENT_E) / 2 - 0.4, y, 5.8), COVER))
roof_parts.append(box("drape_w", (0.14, 12.8, 9.0), (TENT_W - 1.1, 0, 5.8), COVER))
roof = join(roof_parts, "tent_roof")

# door screen on five gold pillars (出26:36-37)
screen_posts = []
for i in range(5):
    y = -5 + i * 2.5
    screen_posts.append(cyl("screen_post", 0.2, 10, (TENT_E, y, 5), GOLD))
    screen_posts.append(box("screen_base", (0.6, 0.6, 0.35), (TENT_E, y, 0.18), BRONZE))
sp = join(screen_posts, "tent_door_posts")
bpy.ops.mesh.primitive_plane_add(size=1, location=(TENT_E + 0.05, 0, 5), rotation=(math.pi / 2, 0, math.pi / 2))
door = bpy.context.active_object
door.name = "tent_door_screen"
door.scale = (10, 10, 1)
bpy.ops.object.transform_apply(scale=True)
door.data.materials.append(GATE)

# veil on four gold pillars with silver bases (出26:31-33)
veil_posts = []
for i in range(4):
    y = -3.75 + i * 2.5
    veil_posts.append(cyl("veil_post", 0.2, 10, (VEIL_X, y, 5), GOLD))
    veil_posts.append(box("veil_base", (0.6, 0.6, 0.35), (VEIL_X, y, 0.18), SILVER))
vp = join(veil_posts, "veil_posts")
bpy.ops.mesh.primitive_plane_add(size=1, location=(VEIL_X + 0.25, 0, 5), rotation=(math.pi / 2, 0, math.pi / 2))
veil = bpy.context.active_object
veil.name = "veil"
veil.scale = (10, 10, 1)
bpy.ops.object.transform_apply(scale=True)
veil.data.materials.append(VEIL)

# ark in the most holy place (出25:10 2.5×1.5×1.5), simplified
ark_parts = [box("ark_box", (2.5, 1.5, 1.5), (VEIL_X - 5, 0, 0.85), GOLD, bevel=0.04),
             box("ark_lid", (2.6, 1.6, 0.14), (VEIL_X - 5, 0, 1.67), GOLD, bevel=0.02)]
for dx in (-0.8, 0.8):
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.32, radius2=0.08, depth=0.9, location=(VEIL_X - 5 + dx, 0, 2.15))
    c = bpy.context.active_object
    c.data.materials.append(GOLD)
    ark_parts.append(c)
ark = join(ark_parts, "ark")

# ------------------------------------------------------------- 香壇 (incense altar)
INC_X = VEIL_X + 2.2
ip = [box("inc_body", (1, 1, 2), (INC_X, 0, 1.0), GOLD, bevel=0.03),
      box("inc_rim", (1.16, 1.16, 0.1), (INC_X, 0, 1.92), GOLD, bevel=0.02)]
for i, (dx, dy) in enumerate([(1, 1), (1, -1), (-1, 1), (-1, -1)]):
    ip.append(horn(f"inc_horn_{i}", (INC_X + dx * 0.42, dy * 0.42, 2.0), 0.14, GOLD, None))
for dy in (0.62, -0.62):
    ip.append(cyl("inc_pole", 0.04, 2.6, (INC_X, dy, 1.6), GOLD, rot=(0, math.pi / 2, 0)))
set_origin(join(ip, "incense_altar"), (INC_X, 0, 0))
empty("anchor_incense", (INC_X, 0, 2.1))

# table (north) and lampstand (south) as simple orientation markers (出26:35)
tbl = [box("table_top", (2, 1, 0.1), (VEIL_X + 6, 3, 1.5), GOLD)]
for dx in (-0.9, 0.9):
    for dy in (-0.4, 0.4):
        tbl.append(box("table_leg", (0.1, 0.1, 1.45), (VEIL_X + 6 + dx, 3 + dy, 0.75), GOLD))
for dx in (-0.6, -0.2, 0.2, 0.6):
    tbl.append(box("bread", (0.34, 0.8, 0.08), (VEIL_X + 6 + dx, 3, 1.6), mat("bread", srgb("#d9b77a"), 0, 0.9)))
join(tbl, "table")
lamp = [cyl("lamp_stem", 0.07, 2.2, (VEIL_X + 6, -3, 1.1), GOLD),
        box("lamp_base", (0.8, 0.8, 0.12), (VEIL_X + 6, -3, 0.06), GOLD)]
for k, r in enumerate((0.3, 0.6, 0.9)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.045, location=(VEIL_X + 6, -3, 2.2 - 0.02),
                                     rotation=(math.pi / 2, 0, 0))
    t = bpy.context.active_object
    # keep only the lower half of the ring (branch arms)
    bm = bmesh.new(); bm.from_mesh(t.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.001], context="VERTS")
    bm.to_mesh(t.data); bm.free()
    t.data.materials.append(GOLD)
    lamp.append(t)
for dx in (-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9):
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.09, radius2=0.14, depth=0.16,
                                    location=(VEIL_X + 6 + dx, -3, 2.3))
    c = bpy.context.active_object
    c.data.materials.append(GOLD)
    lamp.append(c)
lampstand = join(lamp, "lampstand")

# ------------------------------------------------------------- court fence 院子
posts, linens = [], []
POST_H = 5.0


def post(x, y):
    posts.append(cyl("post", 0.18, POST_H, (x, y, POST_H / 2), WOOD, verts=10))
    posts.append(box("post_base", (0.55, 0.55, 0.3), (x, y, 0.15), BRONZE))
    posts.append(cyl("post_cap", 0.22, 0.18, (x, y, POST_H + 0.05), SILVER, verts=10))


# north & south: 20 pillars each over 100 cubits; west: 10 over 50; east: 3+3+4 (出27:10-16)
for i in range(21):
    x = -50 + i * 5
    post(x, 25)
    post(x, -25)
for j in range(1, 10):
    post(-50, -25 + j * 5)
for y in (-20, -15, 15, 20):
    post(50, y)
for y in (-10, -5, 0, 5, 10):
    post(50, y)
join(posts, "fence_posts")

for (w, loc, rz) in [(100, (0, 25, 2.6), 0), (100, (0, -25, 2.6), 0), (50, (-50, 0, 2.6), math.pi / 2),
                     (15, (50, 17.5, 2.6), math.pi / 2), (15, (50, -17.5, 2.6), math.pi / 2)]:
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(math.pi / 2, 0, rz))
    p = bpy.context.active_object
    p.scale = (w, 4.6, 1)
    bpy.ops.object.transform_apply(scale=True)
    p.data.materials.append(LINEN)
    linens.append(p)
join(linens, "fence_linen")

bpy.ops.mesh.primitive_plane_add(size=1, location=(50.1, 0, 2.6), rotation=(math.pi / 2, 0, math.pi / 2))
gate = bpy.context.active_object
gate.name = "gate_screen"
gate.scale = (20, 4.6, 1)
bpy.ops.object.transform_apply(scale=True)
gate.data.materials.append(GATE)

# anchors used by the web scene for labels / camera targets
for name, loc in {
    "anchor_gate": (50, 0, 3),
    "anchor_altar_north": (ALTAR_X, 6, 0.2),
    "anchor_altar_east": (ALTAR_X + 5.2, 0, 0.6),
    "anchor_laver": (LAVER_X, 0, 2.4),
    "anchor_tent_door": (TENT_E, 0, 5),
    "anchor_veil": (VEIL_X, 0, 5),
}.items():
    empty(name, loc)

# single-sided planes should render from both sides
for m in (LINEN, GATE, VEIL):
    m.use_backface_culling = False

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True,
                          export_extras=False, export_cameras=False, export_lights=False)
print("exported", OUT, os.path.getsize(OUT), "bytes;", len(bpy.context.scene.objects), "objects")
