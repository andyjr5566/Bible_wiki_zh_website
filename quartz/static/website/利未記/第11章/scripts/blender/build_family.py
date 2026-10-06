"""利未記 11–15 章網站：營中一家人（父親、母親、女兒）與祭司的人物模型。

在自己的場景 `lev_family_build` 裡建，匯出 public/models/family.glb。
每個人匯出三個節點，three.js 端（src/three/camp.ts 的 figure()）照原本的骨架組回去：
  <id>_body   身體（袍子、頭、臉、頭巾、鬍子），原點在腳底
  <id>_arm    右手臂（袖子＋手），原點在肩膀（人面向 -Y，右手在 -X）；左手臂由程式鏡射
  <id>_cover  父親、祭司頭上可拿下的頭巾／帽子（哀悼時蓬頭要拿掉）
座標：Blender Z 朝上、人面向 -Y；匯出 glTF 後是 three.js 的 Y 朝上、面向 +Z。
單位和舊的木頭棋子一樣：大人頭頂約 4，肩膀在 (±0.62, 2.75)。

用法（Blender MCP socket 9876）：python send.py build_family.py
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

SCENE = 'lev_family_build'
HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else r'C:\Obsidian\Hermes\scripture\appendix\website\利未記\第11章\scripts\blender'
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'family.glb'))

# ---------------------------------------------------------------- 場景

orig = next(s for s in bpy.data.scenes if s.name != SCENE)
if SCENE in bpy.data.scenes:
    old = bpy.data.scenes[SCENE]
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
# 上一次建的網格、相機、燈沒人用了就清掉，名字才不會變成 xxx.001
for coll in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
    for d in list(coll):
        if d.users == 0:
            coll.remove(d)
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc

MATS = {}


def mat(name, color, rough=0.75, sheen=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    # sRGB → linear
    lin = tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
    bsdf.inputs['Base Color'].default_value = (*lin, 1)
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*lin, 1)
    MATS[name] = m
    return m


def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def lathe(name, prof, material, seg=24, cap_top=False, scale=(1, 1, 1), loc=(0, 0, 0), arc=None, cap_bottom=False):
    """以 Z 為軸旋轉一條 (半徑, 高度) 剖面線。arc=(起, 迄) 角度（度）只轉一段，前面留開口。"""
    bm = bmesh.new()
    rings = []
    closed = arc is None
    n = seg if closed else seg + 1
    for r, z in prof:
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / seg if closed else math.radians(arc[0] + (arc[1] - arc[0]) * i / seg)
            ring.append(bm.verts.new((r * math.cos(a) * scale[0] + loc[0], r * math.sin(a) * scale[1] + loc[1], z * scale[2] + loc[2])))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % n
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    if cap_top:
        bm.faces.new(list(reversed(rings[-1])))
    if cap_bottom and closed:
        # 袍子底部封起來：人躺下時才不會看到裡面是空的
        bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def sphere(name, r, loc, material, scale=(1, 1, 1), seg=18, rings=12, cut=None, face=None):
    """cut=z0 只留 z>=z0 的部分；face=z1 在前面（-Y）z<z1 的地方挖出臉的開口（都以 r 為單位）"""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    if cut is not None:
        dead = [v for v in bm.verts if v.co.z < cut * r - 1e-6]
        bmesh.ops.delete(bm, geom=dead, context='VERTS')
    if face is not None:
        dead = [v for v in bm.verts if v.co.y < -0.3 * r and v.co.z < face * r]
        bmesh.ops.delete(bm, geom=dead, context='VERTS')
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return obj_from_bm(name, bm, material)


def cyl(name, r1, r2, h, loc, material, seg=20, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    if rot:
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(rot[1], 3, rot[0]))
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return obj_from_bm(name, bm, material)


def torus(name, R, r, loc, material, scale=(1, 1, 1), seg=24, tseg=8):
    bm = bmesh.new()
    for i in range(seg):
        a = 2 * math.pi * i / seg
        for k in range(tseg):
            b = 2 * math.pi * k / tseg
            bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        for k in range(tseg):
            a = i * tseg + k
            b = ((i + 1) % seg) * tseg + k
            c = ((i + 1) % seg) * tseg + (k + 1) % tseg
            d = i * tseg + (k + 1) % tseg
            bm.faces.new((bm.verts[a], bm.verts[b], bm.verts[c], bm.verts[d]))
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return obj_from_bm(name, bm, material)


def join(name, parts, origin=(0, 0, 0)):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    # 原點移到指定位置
    off = Vector(origin)
    o.data.transform(Matrix.Translation(-off))
    o.location = off
    return o


# ---------------------------------------------------------------- 造型

SKIN = mat('skin', '#c9976d', 0.6)
SKIN_D = mat('skin_shade', '#a87552', 0.6)
EYE = mat('eye', '#22170f', 0.35)
BLUSH = mat('blush', '#d98a7a', 0.7)
BEARD = mat('beard', '#3d2b1e', 0.9)
HAIR = mat('hair', '#2e2018', 0.85)

LOOK = {
    'father': dict(robe='#6f5236', hem='#4a3523', sash='#a8743a', head='#d9cba8', band='#3a2a1e', scale=1.0, beard=True),
    'mother': dict(robe='#8e4b3c', hem='#5f2e25', sash='#d2a24c', head='#c9a46e', scale=1.0, scarf=True),
    'daughter': dict(robe='#b58a4f', hem='#8a6233', sash='#9e3b2e', head='#e3cd9e', scale=1.0, child=True),
    'priest': dict(robe='#f3eee2', hem='#ded6c4', sash='#b3263a', head='#fbf8f0', scale=1.0, beard=True, priest=True),
}


def build(id_, L, x):
    robe = mat(f'robe_{id_}', L['robe'], 0.85)
    hem = mat(f'hem_{id_}', L['hem'], 0.9)
    sash = mat(f'sash_{id_}', L['sash'], 0.7)
    head = mat(f'head_{id_}', L['head'], 0.9)
    child = L.get('child')
    parts = []
    # 袍子：下擺寬、腰收、肩圓；孩子的比例肩窄、頭大
    if child:
        prof = [(0.86, 0.0), (0.84, 0.12), (0.76, 0.7), (0.62, 1.5), (0.56, 2.05), (0.54, 2.5), (0.47, 2.78), (0.3, 2.92), (0.0, 2.95)]
    else:
        prof = [(0.98, 0.0), (0.96, 0.12), (0.86, 0.8), (0.7, 1.7), (0.6, 2.05), (0.62, 2.45), (0.6, 2.72), (0.42, 2.92), (0.2, 3.02), (0.0, 3.04)]
    parts.append(lathe(f'{id_}_robe', prof, robe, cap_bottom=True))
    # 下擺一圈深色滾邊
    hem_r = prof[1][0]
    parts.append(lathe(f'{id_}_hem', [(hem_r + 0.012, 0.0), (hem_r + 0.015, 0.1), (hem_r - 0.02, 0.26)], hem))
    # 腰帶
    wz = 1.95 if not child else 1.75
    wr = 0.615 if not child else 0.58
    parts.append(torus(f'{id_}_sash', wr, 0.07, (0, 0, wz), sash, scale=(1, 1, 1.4)))
    # 腰帶垂下的一端（在身體左前方）
    tail = cyl(f'{id_}_sashend', 0.07, 0.09, 0.7, (-0.28, -0.55, wz - 0.38), sash, seg=8)
    tail.rotation_euler = (0.12, 0, 0)
    parts.append(tail)
    # 頸、頭
    hz = 3.45 if not child else 3.35
    hr = 0.47 if not child else 0.55
    parts.append(cyl(f'{id_}_neck', 0.17, 0.19, 0.3, (0, 0, hz - hr - 0.02), SKIN, seg=12))
    parts.append(sphere(f'{id_}_head', hr, (0, 0, hz), SKIN, scale=(0.94, 0.94, 1.04), seg=24, rings=16))
    # 臉：眼睛、鼻子、（女性）臉頰
    fy = -hr * 0.92
    for s in (1, -1):
        parts.append(sphere(f'{id_}_eye{s}', 0.055 if not child else 0.065, (s * hr * 0.33, fy, hz + 0.05), EYE, seg=10, rings=8, scale=(1, 0.6, 1.25)))
        if not L.get('beard'):
            parts.append(sphere(f'{id_}_cheek{s}', 0.08, (s * hr * 0.5, fy * 0.93, hz - 0.12), BLUSH, seg=10, rings=8, scale=(1.2, 0.4, 0.8)))
    parts.append(sphere(f'{id_}_nose', 0.07, (0, fy - 0.03, hz - 0.06), SKIN_D, seg=10, rings=8, scale=(0.8, 0.9, 1.1)))
    if L.get('beard'):
        # 鬍子：下巴一塊、上唇一道
        parts.append(sphere(f'{id_}_beard', hr * 0.8, (0, -hr * 0.42, hz - hr * 0.52), BEARD if not L.get('priest') else mat('beard_grey', '#6a5a4a', 0.9), scale=(0.95, 0.72, 1.0)))
        parts.append(torus(f'{id_}_must', hr * 0.32, 0.05, (0, fy * 0.96, hz - 0.2), BEARD if not L.get('priest') else mat('beard_grey', '#6a5a4a', 0.9), scale=(1, 0.35, 0.6), seg=16, tseg=6))
    cover = []
    if L.get('scarf') or child:
        # 頭巾：包住頭頂和後腦，垂到肩上；前面留出臉
        parts.append(sphere(f'{id_}_hood', hr * 1.1, (0, hr * 0.05, hz + 0.02), head, scale=(1.0, 1.0, 1.05), cut=-0.55, face=0.42))
        drape_top = hz - 0.05
        dr = hr * 1.1
        parts.append(lathe(f'{id_}_drape', [(dr, drape_top), (dr * 1.08, drape_top - 0.35), (0.66 if not child else 0.6, 2.62 if not child else 2.45)], head, loc=(0, hr * 0.12, 0), arc=(-30, 210)))
        # 髮際：額前露出一點頭髮
        parts.append(sphere(f'{id_}_fringe', hr * 0.98, (0, -0.02, hz + 0.06), HAIR, cut=0.45))
        if child:
            # 女兒：頭巾後面露出一條辮子
            for k in range(4):
                parts.append(sphere(f'{id_}_braid{k}', 0.11 - k * 0.012, (0.0, hr * 0.95 + 0.06, hz - 0.45 - k * 0.2), HAIR, seg=10, rings=8, scale=(1, 1, 1.25)))
    elif L.get('priest'):
        # 祭司：細麻布的帽子（纏頭），一圈一圈
        t = [cyl(f'{id_}_cap', 0.5, 0.48, 0.5, (0, 0, hz + 0.35), head, seg=24)]
        for k in range(3):
            t.append(torus(f'{id_}_wrap{k}', 0.49 + 0.015 * (k % 2), 0.06, (0, 0, hz + 0.16 + k * 0.15), head, seg=24, tseg=8))
        cover = t
    else:
        # 父親：頭巾從頭頂垂到肩後，額上一道繩圈
        t = [sphere(f'{id_}_kef', hr * 1.12, (0, hr * 0.05, hz + 0.02), head, cut=-0.5, face=0.4),
             lathe(f'{id_}_kefdrape', [(hr * 1.12, hz - 0.02), (hr * 1.2, hz - 0.45), (0.68, 2.7)], head, loc=(0, hr * 0.18, 0), arc=(-25, 205)),
             torus(f'{id_}_agal', hr * 1.05, 0.05, (0, hr * 0.04, hz + 0.24), mat('agal', L['band'], 0.8), scale=(1, 1, 0.9), seg=24, tseg=8)]
        cover = t
    if L.get('priest'):
        # 祭司的腰帶垂下兩端
        parts.append(cyl(f'{id_}_sashend2', 0.07, 0.09, 0.9, (0.25, -0.55, wz - 0.48), sash, seg=8))
    body = join(f'{id_}_body', parts)
    c = join(f'{id_}_cover', cover) if cover else None
    # 右手臂：袖子（往下變寬）＋手，原點在肩膀。人面向 -Y，右手在 -X
    sh = (-0.62, 0, 2.75) if not child else (-0.58, 0, 2.55)
    alen = 1.0 if not child else 0.85
    sl = cyl(f'{id_}_sleeve', 0.15, 0.21, alen, (sh[0], 0, sh[2] - alen / 2 - 0.05), robe, seg=14)
    cap = sphere(f'{id_}_shoulder', 0.16, sh, robe, seg=14, rings=10)
    hand = sphere(f'{id_}_hand', 0.14, (sh[0], -0.02, sh[2] - alen - 0.25), SKIN, seg=14, rings=10, scale=(0.85, 0.9, 1.1))
    arm = join(f'{id_}_arm', [sl, cap, hand], origin=sh)
    root = bpy.data.objects.new(f'fig_{id_}', None)
    sc.collection.objects.link(root)
    for o in (body, c, arm):
        if o:
            o.parent = root
    root.location = (x, 0, 0)
    return root


roots = [build(k, v, i * 2.6) for i, (k, v) in enumerate(LOOK.items())]
# 預覽用：鏡射出左手（不匯出）
for r in roots:
    a = next(c for c in r.children if c.name.endswith('_arm'))
    m = a.copy()
    m.name = 'prev_' + a.name + 'L'
    sc.collection.objects.link(m)
    m.parent = r
    m.location.x = -a.location.x
    m.scale.x = -1

# ---------------------------------------------------------------- 預覽燈光與鏡頭
sun = bpy.data.objects.new('prev_sun', bpy.data.lights.new('prev_sun', 'SUN'))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new('prev_cam', bpy.data.cameras.new('prev_cam'))
cam.location = (3.9, -13.5, 3.6)
cam.rotation_euler = (math.radians(84), 0, 0)
cam.data.lens = 50
sc.collection.objects.link(cam)
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 1400, 700
world = bpy.data.worlds.get('prev_world') or bpy.data.worlds.new('prev_world')
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (0.82, 0.74, 0.6, 1)
bg.inputs[1].default_value = 0.8
sc.world = world

# ---------------------------------------------------------------- 匯出
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in sc.objects:
    if (o.name.startswith('fig_') or (o.parent and o.parent.name.startswith('fig_'))) and not o.name.startswith('prev_'):
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, use_active_scene=True,
                          export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
print('exported', OUT, os.path.getsize(OUT))
bpy.context.window.scene = sc
