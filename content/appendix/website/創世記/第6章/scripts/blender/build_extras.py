"""Birds (raven, dove) with a wing-flap loop, simple robed figures, and a stone altar.

Run inside Blender through the MCP socket:  python send.py build_extras.py
Writes public/models/{birds,figures,altar}.glb.  Metres, +Z up in Blender.
None of these shapes is described in Genesis; they are illustrative props.
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.environ.get("EXTRAS_OUT") or r"C:\Obsidian\Hermes\scripture\appendix\website\創世記\第6章\public\models"
FPS = 24


def fresh_scene(name):
    old = bpy.data.scenes.get(name)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    scn = bpy.data.scenes.new(name)
    scn.render.fps = FPS
    bpy.context.window.scene = scn
    return scn


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def mat(name, color, rough=0.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    return m


def mesh_obj(scn, name, bm, material, parent=None, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me)
    scn.collection.objects.link(o)
    o.location = loc
    if parent:
        o.parent = parent
    return o


def ellipsoid(bm, c, s, sub=2):
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*s, 1)))


def cone(bm, c, r1, r2, d, seg=8, rot=(0, 0, 0)):
    m = Matrix.Translation(c) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X")
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d, matrix=m)


def export(scn, path, anim=False):
    for o in scn.objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(scn.objects))
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_animations=anim, export_animation_mode="SCENE",
                              export_force_sampling=True, export_materials="EXPORT")
    print("exported", path, os.path.getsize(path))


# ============================================================== birds
scn = fresh_scene("birds_build")


def wing_bm(span, chord, side):
    """A flat, slightly cambered wing with a feathered trailing edge, root at origin."""
    bm = bmesh.new()
    n = 6
    lead, trail = [], []
    for i in range(n + 1):
        t = i / n
        y = side * span * t
        c = chord * (1 - 0.55 * t ** 1.4)
        x_lead = 0.02 * t
        z = 0.03 * math.sin(t * math.pi) * (1 - t)
        lead.append(bm.verts.new((x_lead, y, z)))
        jag = 0.05 * chord if (i % 2 and i > 1) else 0
        trail.append(bm.verts.new((x_lead - c - jag, y, z - 0.01)))
    for i in range(n):
        q = [lead[i], lead[i + 1], trail[i + 1], trail[i]]
        bm.faces.new(q if side > 0 else list(reversed(q)))
    # underside so it reads from both sides
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.012)
    return bm


def make_bird(name, body_col, beak_col, eye_col, length, offset_y):
    body_m = mat(f"{name}_body", body_col, 0.7)
    beak_m = mat(f"{name}_beak", beak_col, 0.5)
    eye_m = mat(f"{name}_eye", eye_col, 0.3)
    root = bpy.data.objects.new(name, None)
    scn.collection.objects.link(root)
    root.location = (0, offset_y, 0)
    L = length
    bm = bmesh.new()
    ellipsoid(bm, (0, 0, 0), (L * 0.42, L * 0.17, L * 0.16))
    ellipsoid(bm, (L * 0.36, 0, L * 0.1), (L * 0.13, L * 0.11, L * 0.11))
    # tail fan
    t = [bm.verts.new(p) for p in ((-L * 0.3, -L * 0.05, 0.0), (-L * 0.62, -L * 0.14, -0.01), (-L * 0.66, 0, -0.005), (-L * 0.62, L * 0.14, -0.01), (-L * 0.3, L * 0.05, 0.0))]
    bm.faces.new(t)
    bmesh.ops.solidify(bm, geom=[f for f in bm.faces if len(f.verts) == 5], thickness=0.01)
    body = mesh_obj(scn, f"{name}_bodymesh", bm, body_m, root)
    bm = bmesh.new()
    cone(bm, (L * 0.5, 0, L * 0.09), L * 0.035, 0.0, L * 0.12, seg=6, rot=(0, math.pi / 2, 0))
    mesh_obj(scn, f"{name}_beakmesh", bm, beak_m, root)
    bm = bmesh.new()
    for s in (-1, 1):
        ellipsoid(bm, (L * 0.43, s * L * 0.075, L * 0.14), (L * 0.018, L * 0.018, L * 0.018), 1)
    mesh_obj(scn, f"{name}_eyes", bm, eye_m, root)
    wings = []
    for side in (1, -1):
        w = mesh_obj(scn, f"{name}_wing_{'l' if side > 0 else 'r'}", wing_bm(L * 0.95, L * 0.38, side), body_m, root, loc=(L * 0.12, side * L * 0.1, L * 0.06))
        wings.append((w, side))
    # flap loop: 12 frames down-up, recorded as its own action
    frames = 12
    for w, side in wings:
        w.animation_data_create()
        act = bpy.data.actions.new(f"{name}_flap")
        w.animation_data.action = act
        for f in range(frames + 1):
            ph = f / frames * 2 * math.pi
            w.rotation_euler = (side * math.radians(38) * math.sin(ph), math.radians(6) * math.cos(ph), 0)
            w.keyframe_insert("rotation_euler", frame=f + 1)
    return root


raven = make_bird("raven", "#1b1c22", "#2a2a2e", "#0a0a0a", 0.55, -1.0)
dove = make_bird("dove", "#e9e6df", "#c98a6a", "#1a1010", 0.36, 1.0)
# the olive leaf (創8:11), shown only on the return flight
lm = mat("olive_leaf", "#6f8a3a", 0.6)
bm = bmesh.new()
pts = [(0, 0, 0), (0.04, 0.018, 0), (0.09, 0.012, 0), (0.12, 0, 0), (0.09, -0.012, 0), (0.04, -0.018, 0)]
bm.faces.new([bm.verts.new(p) for p in pts])
bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.004)
leaf = mesh_obj(scn, "olive_leaf", bm, lm, bpy.data.objects["dove"], loc=(0.36 * 0.56, 0, 0.36 * 0.06))
scn.frame_start, scn.frame_end = 1, 13
export(scn, os.path.join(ROOT, "birds.glb"), anim=True)

# ============================================================== figures (創7:13 八口)
scn = fresh_scene("figures_build")
rnd = random.Random(7)
robes = ["#6d5a44", "#8a6a4a", "#5b5040", "#7a4f36", "#a38a66", "#6a5d4d", "#8f7658", "#58483a"]
skin = mat("skin", "#b58766", 0.6)
names = ["noah", "wife", "shem", "shem_wife", "ham", "ham_wife", "japheth", "japheth_wife"]
for i, nm in enumerate(names):
    female = i % 2 == 1
    h = 1.62 if female else 1.74
    if nm == "noah":
        h = 1.7
    rm = mat(f"robe_{i}", robes[i], 0.95)
    root = bpy.data.objects.new(nm, None)
    scn.collection.objects.link(root)
    root.location = (i * 1.2, 0, 0)
    bm = bmesh.new()
    cone(bm, (0, 0, h * 0.4), 0.3 if female else 0.27, 0.16, h * 0.8, seg=10)
    cone(bm, (0, 0, h * 0.84), 0.17, 0.13, h * 0.1, seg=10)     # shoulders
    # head covering
    ellipsoid(bm, (-0.01, 0, h * 0.935), (0.115, 0.11, 0.12), 1)
    cone(bm, (-0.05, 0, h * 0.82), 0.16, 0.1, 0.28, seg=8)
    mesh_obj(scn, f"{nm}_robe", bm, rm, root)
    bm = bmesh.new()
    ellipsoid(bm, (0.04, 0, h * 0.925), (0.085, 0.085, 0.1), 1)
    for s in (-1, 1):
        ellipsoid(bm, (0.06, s * 0.2, h * 0.55), (0.045, 0.045, 0.05), 1)
    if nm == "noah" or not female:
        cone(bm, (0.08, 0, h * 0.86), 0.06, 0.02, 0.14 if nm == "noah" else 0.08, seg=6)   # beard
    mesh_obj(scn, f"{nm}_skin", bm, skin, root)
    # staff for Noah
    if nm == "noah":
        bm = bmesh.new()
        cone(bm, (0.18, -0.25, 0.95), 0.02, 0.02, 1.9, seg=6)
        mesh_obj(scn, "noah_staff", bm, mat("staff", "#4a3420", 0.9), root)
export(scn, os.path.join(ROOT, "figures.glb"))

# ============================================================== altar (創8:20)
scn = fresh_scene("altar_build")
stone = mat("altar_stone", "#8d857a", 0.95)
rnd = random.Random(20)
bm = bmesh.new()
for layer in range(4):
    r = 1.35 - layer * 0.12
    n = 10 - layer
    for k in range(n):
        a = k / n * 2 * math.pi + layer * 0.3
        c = Vector((math.cos(a) * r, math.sin(a) * r, 0.22 + layer * 0.36))
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0,
                                         matrix=Matrix.Translation(c) @ Matrix.Rotation(rnd.random() * 3, 4, "Z") @ Matrix.Diagonal((0.38 + rnd.random() * 0.12, 0.3 + rnd.random() * 0.1, 0.2 + rnd.random() * 0.05, 1)))
        for v in res["verts"]:
            v.co += Vector((rnd.uniform(-0.04, 0.04), rnd.uniform(-0.04, 0.04), rnd.uniform(-0.03, 0.03)))
# fill and top
bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=1.25, radius2=1.0, depth=1.35, matrix=Matrix.Translation((0, 0, 0.68)))
res = bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((0, 0, 1.42)) @ Matrix.Diagonal((1.9, 1.4, 0.16, 1)))
mesh_obj(scn, "altar", bm, stone)
wood = mat("altar_wood", "#5a3a20", 0.9)
bm = bmesh.new()
for k in range(7):
    a = k * 0.45
    cone(bm, (math.cos(a) * 0.15, math.sin(a) * 0.3, 1.6 + (k % 2) * 0.1), 0.06, 0.06, 1.3, seg=6, rot=(0, math.pi / 2, a))
mesh_obj(scn, "altar_wood", bm, wood)
export(scn, os.path.join(ROOT, "altar.glb"))
