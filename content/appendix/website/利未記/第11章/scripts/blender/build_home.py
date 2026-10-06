"""利未記 11–15 章網站：這一家的帳棚、煮湯的瓦罐（含蓋子與預先切好的碎片）、死蜥蜴。

在自己的場景 `lev_home_build` 裡建，匯出 public/models/home.glb。節點：
  home_tent       這一家的帳棚：門在 -Y（three.js 的 +Z），原點在地面中心
  pot             完整的瓦罐（含湯面），原點在罐底中心
  pot_lid         蓋子，原點在蓋子底面中心（放在罐口上：y = POT_RIM）
  pot_shard_XX    打破後的碎片，原點在每片的中心；位置就是在罐子上原本的位置
  lizard          死蜥蜴（翻過來、肚子朝上），原點在身體中心
碎片怎麼飛由 three.js 算（src/three/camp.ts），這裡只負責把罐子切開。
座標：Blender Z 朝上；匯出 glTF 後是 three.js 的 Y 朝上。單位和網站的營地一樣（大人約 4 高）。

用法：python send.py build_home.py
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

SCENE = 'lev_home_build'
HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else r'C:\Obsidian\Hermes\scripture\appendix\website\利未記\第11章\scripts\blender'
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'home.glb'))
rng = random.Random(11)

if SCENE in bpy.data.scenes:
    old = bpy.data.scenes[SCENE]
    for o in list(old.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(old)
for coll in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
    for d in list(coll):
        if d.users == 0:
            coll.remove(d)
sc = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = sc

MATS = {}


def mat(name, color, rough=0.8):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    c = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
    bsdf.inputs['Base Color'].default_value = (*lin, 1)
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*lin, 1)
    MATS[name] = m
    return m


def to_obj(name, bm, mats, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        o.data.materials.append(m)
    return o


def set_origin(o, at):
    o.data.transform(Matrix.Translation(-Vector(at)))
    o.location = Vector(at)


def join(name, parts):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


# ================================================================ 瓦罐

CLAY = mat('clay', '#b4673e', 0.85)
CLAY_IN = mat('clay_in', '#7a3f22', 0.9)
SOUP = mat('soup', '#8a5a2c', 0.35)

# 寬口煮鍋的剖面（半徑, 高度）：外壁由下往上
PROF = [(0.42, 0.0), (0.62, 0.12), (0.8, 0.42), (0.86, 0.72), (0.8, 1.0), (0.66, 1.2), (0.6, 1.3), (0.66, 1.4), (0.7, 1.46)]
WALL = 0.07
POT_RIM = 1.46
SOUP_Z = 1.12


def r_at(z):
    for (r0, z0), (r1, z1) in zip(PROF, PROF[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return PROF[-1][0]


def wall_patch(a0, a1, z0, z1, na=6, nz=4):
    """瓦罐壁的一塊（有厚度）：角度 a0–a1、高度 z0–z1"""
    bm = bmesh.new()
    outer, inner = [], []
    for k in range(nz + 1):
        z = z0 + (z1 - z0) * k / nz
        ro = r_at(z)
        ri = max(0.05, ro - WALL)
        orow, irow = [], []
        for i in range(na + 1):
            a = a0 + (a1 - a0) * i / na
            orow.append(bm.verts.new((ro * math.cos(a), ro * math.sin(a), z)))
            irow.append(bm.verts.new((ri * math.cos(a), ri * math.sin(a), z)))
        outer.append(orow)
        inner.append(irow)
    for k in range(nz):
        for i in range(na):
            bm.faces.new((outer[k][i], outer[k][i + 1], outer[k + 1][i + 1], outer[k + 1][i])).material_index = 0
            bm.faces.new((inner[k][i], inner[k + 1][i], inner[k + 1][i + 1], inner[k][i + 1])).material_index = 1
    # 斷面
    for k in range(nz):
        for i in (0, na):
            f = bm.faces.new((outer[k][i], outer[k + 1][i], inner[k + 1][i], inner[k][i]))
            f.material_index = 1
    for k in (0, nz):
        for i in range(na):
            f = bm.faces.new((outer[k][i], inner[k][i], inner[k][i + 1], outer[k][i + 1]))
            f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bottom_disc(r, z, seg=20):
    bm = bmesh.new()
    top = [bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z + WALL)) for i in range(seg)]
    bot = [bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)]
    bm.faces.new(top).material_index = 1
    bm.faces.new(list(reversed(bot))).material_index = 0
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((bot[i], bot[j], top[j], top[i])).material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# 完整的罐子
whole = wall_patch(0, 2 * math.pi, 0.0, POT_RIM, na=32, nz=16)
bmesh.ops.remove_doubles(whole, verts=whole.verts, dist=1e-5)
pot = to_obj('pot', whole, [CLAY, CLAY_IN])
base = to_obj('pot_base', bottom_disc(0.42, 0.0), [CLAY, CLAY_IN])
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=28, radius=r_at(SOUP_Z) - WALL + 0.01)
bmesh.ops.translate(bm, vec=(0, 0, SOUP_Z), verts=bm.verts)
soup = to_obj('pot_soup', bm, SOUP)
pot = join('pot', [pot, base, soup])

# 蓋子：淺圓頂＋把手
bm = bmesh.new()
lid_prof = [(0.76, 0.0), (0.74, 0.06), (0.6, 0.16), (0.36, 0.24), (0.14, 0.27), (0.0, 0.28)]
seg = 28
rings = []
for r, z in lid_prof:
    rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)])
for k in range(len(rings) - 1):
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
bm.faces.new(list(reversed(rings[0])))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
lid = to_obj('pot_lid', bm, CLAY)
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.11)
bmesh.ops.scale(bm, vec=(1, 1, 0.75), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0, 0, 0.33), verts=bm.verts)
knob = to_obj('pot_knob', bm, CLAY)
lid = join('pot_lid', [lid, knob])

# 碎片：7 個扇區 × 3 層，角度、高度都打亂一點；底部一片
cuts_a = sorted(2 * math.pi * (i + rng.uniform(-0.25, 0.25)) / 7 for i in range(7))
cuts_z = [0.0, 0.5 + rng.uniform(-0.08, 0.08), 0.98 + rng.uniform(-0.08, 0.08), POT_RIM]
shards = []
n = 0
for j in range(3):
    for i in range(7):
        a0 = cuts_a[i] + (rng.uniform(-0.12, 0.12) if j else 0)
        a1 = (cuts_a[(i + 1) % 7] + (2 * math.pi if i == 6 else 0)) + (rng.uniform(-0.12, 0.12) if j else 0)
        o = to_obj(f'pot_shard_{n:02d}', wall_patch(a0, a1, cuts_z[j], cuts_z[j + 1]), [CLAY, CLAY_IN], smooth=True)
        c = sum((v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
        set_origin(o, c)
        shards.append(o)
        n += 1
o = to_obj(f'pot_shard_{n:02d}', bottom_disc(0.42, 0.0), [CLAY, CLAY_IN])
set_origin(o, (0, 0, 0.03))
shards.append(o)

# ================================================================ 蜥蜴（死的：翻過來，肚子朝上）

LIZ = mat('lizard', '#6b7a4a', 0.7)
LIZ_B = mat('lizard_belly', '#c9c08a', 0.8)


def blob(name, r, loc, scale, m, seg=14, rings=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bmesh.ops.translate(bm, vec=loc, verts=bm.verts)
    return to_obj(name, bm, m)


parts = []
# 身體沿 Y（頭在 -Y），一節一節變細的尾巴彎向一邊
parts.append(blob('liz_body', 0.16, (0, 0, 0), (0.9, 2.1, 0.62), LIZ))
parts.append(blob('liz_belly', 0.15, (0, 0, -0.05), (0.8, 1.9, 0.45), LIZ_B))
parts.append(blob('liz_head', 0.12, (0, -0.42, 0.01), (1.0, 1.45, 0.7), LIZ))
for s in (1, -1):
    parts.append(blob(f'liz_eye{s}', 0.025, (s * 0.075, -0.47, 0.06), (1, 1, 1), mat('liz_eye', '#1d1a12', 0.4), seg=8, rings=6))
def tube(name, pts, radii, m, seg=8):
    """沿著一串點長出一條變細的管子（尾巴、腳）"""
    bm = bmesh.new()
    rings = []
    for k, (p, r) in enumerate(zip(pts, radii)):
        p = Vector(p)
        d = (Vector(pts[min(k + 1, len(pts) - 1)]) - Vector(pts[max(k - 1, 0)])).normalized()
        a = d.orthogonal().normalized()
        b = d.cross(a)
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * i / seg) + b * math.sin(2 * math.pi * i / seg)) * r) for i in range(seg)])
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
    tip = bm.verts.new(Vector(pts[-1]) + (Vector(pts[-1]) - Vector(pts[-2])).normalized() * radii[-1])
    for i in range(seg):
        bm.faces.new((rings[-1][i], rings[-1][(i + 1) % seg], tip))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_obj(name, bm, m)


# 尾巴：從身體後端往後，慢慢彎向一邊、越來越細
tail_pts = [(0.03 * (k / 10) ** 2 * 10, 0.28 + 0.085 * k, 0.0) for k in range(11)]
parts.append(tube('liz_tail', tail_pts, [0.1 * (1 - k / 11) ** 1.2 + 0.008 for k in range(11)], LIZ))
# 四條腿：大腿往外、小腿往前或往後彎，腳趾三根
for sx in (1, -1):
    for sy, dy in ((-1, -0.2), (1, 0.18)):
        hip = Vector((sx * 0.1, dy, 0.0))
        knee = Vector((sx * 0.25, dy + sy * 0.02, 0.05))
        foot = Vector((sx * 0.32, dy + sy * 0.14, 0.0))
        parts.append(tube(f'liz_leg{sx}{sy}', [hip, hip.lerp(knee, 0.5), knee, knee.lerp(foot, 0.5), foot], [0.045, 0.038, 0.032, 0.028, 0.024], LIZ, seg=6))
        for f in (-1, 0, 1):
            ang = math.atan2(foot.y - knee.y, foot.x - knee.x) + f * 0.6
            tip = foot + Vector((math.cos(ang) * 0.07, math.sin(ang) * 0.07, 0))
            parts.append(tube(f'liz_toe{sx}{sy}{f}', [foot, foot.lerp(tip, 0.5), tip], [0.016, 0.013, 0.01], LIZ, seg=5))
liz = join('lizard', parts)
# 翻過來：繞 Y 軸轉半圈（肚子朝上）
liz.data.transform(Matrix.Rotation(math.pi, 4, 'Y'))
liz.location = (0, 0, 0)

# ================================================================ 帳棚

TENT = mat('tent_cloth', '#4a3a2e', 0.95)
TENT_S = mat('tent_stripe', '#8a7458', 0.95)
POLE = mat('tent_pole', '#6b4a2a', 0.8)
ROPE = mat('tent_rope', '#a8916a', 0.9)
RUG = mat('rug', '#9e3b2e', 0.9)
RUG_B = mat('rug_band', '#d8b36a', 0.9)
DARK = mat('tent_dark', '#1c140e', 1.0)

W, D, H = 4.8, 4.1, 5.0  # 半寬（X）、半深（Y）、脊高


def tent_cloth():
    """屋頂兩片布，脊線沿 Y，布在柱子之間微微下垂；條紋另外一種顏色"""
    bm = bmesh.new()
    nx, ny = 8, 12
    for side in (1, -1):
        grid = []
        for i in range(nx + 1):
            u = i / nx  # 0＝脊、1＝下緣
            row = []
            for j in range(ny + 1):
                v = j / ny
                y = -D + 2 * D * v
                sag = 0.28 * math.sin(math.pi * v * 2) ** 2 * math.sin(math.pi * u)  # 兩根柱子之間下垂
                z = H * (1 - u) + 0.25 * u - sag
                x = side * W * u
                row.append(bm.verts.new((x, y, z)))
            grid.append(row)
        for i in range(nx):
            for j in range(ny):
                f = bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
                f.material_index = 1 if (j // 2) % 3 == 1 else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_obj('tent_roof', bm, [TENT, TENT_S], smooth=True)


def gable(back):
    """山牆：後面整片；前面左右兩片，中間是門洞"""
    bm = bmesh.new()
    y = D if back else -D
    if back:
        bm.faces.new([bm.verts.new(p) for p in ((-W, y, 0.25), (W, y, 0.25), (0, y, H))])
    else:
        dw, dh = 1.5, 3.4
        for s in (1, -1):
            pts = [(s * dw, y, 0.0), (s * W, y, 0.25), (0, y, H), (0, y, dh + 0.3), (s * dw * 0.55, y, dh)]
            bm.faces.new([bm.verts.new(p) for p in pts])
        # 門簾捲起來掛在門楣上
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_obj('tent_gable_b' if back else 'tent_gable_f', bm, TENT, smooth=False)


parts = [tent_cloth(), gable(True), gable(False)]
# 門洞裡面暗暗的
bm = bmesh.new()
bm.faces.new([bm.verts.new(p) for p in ((-1.5, -D + 0.25, 0.0), (1.5, -D + 0.25, 0.0), (0.82, -D + 0.25, 3.4), (0, -D + 0.25, 3.7), (-0.82, -D + 0.25, 3.4))])
parts.append(to_obj('tent_door', bm, DARK, smooth=False))
# 捲起來的門簾
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.2, radius2=0.2, depth=1.9)
bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
bmesh.ops.translate(bm, vec=(0, -D - 0.12, 3.55), verts=bm.verts)
parts.append(to_obj('tent_flap', bm, TENT_S))
# 柱子：中間一根、後面一根
for y in (0.0, D + 0.05):  # 前面不立柱子，免得擋住門
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.12, radius2=0.1, depth=H + 0.5)
    bmesh.ops.translate(bm, vec=(0, y, (H + 0.5) / 2), verts=bm.verts)
    parts.append(to_obj(f'tent_pole{y:.0f}', bm, POLE))
# 拉繩和木樁：左右各三條
for s in (1, -1):
    for y in (-D * 0.8, 0.0, D * 0.8):
        a = Vector((s * W * 0.55, y, H * 0.45 + 0.2))
        b = Vector((s * (W + 2.2), y * 1.08, 0.0))
        bm = bmesh.new()
        L = (b - a).length
        bmesh.ops.create_cone(bm, cap_ends=False, segments=5, radius1=0.03, radius2=0.03, depth=L)
        q = (b - a).normalized().to_track_quat('Z', 'Y')
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=q.to_matrix())
        bmesh.ops.translate(bm, vec=(a + b) / 2, verts=bm.verts)
        parts.append(to_obj(f'tent_rope{s}{y:.0f}', bm, ROPE, smooth=False))
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.08, radius2=0.05, depth=0.6)
        bmesh.ops.translate(bm, vec=(b.x, b.y, 0.2), verts=bm.verts)
        parts.append(to_obj(f'tent_stake{s}{y:.0f}', bm, POLE))
# 門前的地毯
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
bmesh.ops.scale(bm, vec=(1.6, 1.15, 1), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0, -D - 1.5, 0.04), verts=bm.verts)
parts.append(to_obj('rug', bm, RUG, smooth=False))
for yy in (-D - 0.45, -D - 2.55):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bmesh.ops.scale(bm, vec=(1.6, 0.1, 1), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, yy, 0.05), verts=bm.verts)
    parts.append(to_obj('rug_band', bm, RUG_B, smooth=False))
# 帳棚邊放的兩個陶罐和一袋糧
for k, (x, y, r, h) in enumerate(((W - 0.9, -D + 0.9, 0.45, 1.1), (W - 1.7, -D + 0.6, 0.35, 0.8))):
    prof = [(r * 0.55, 0), (r, h * 0.45), (r * 0.8, h * 0.85), (r * 0.35, h), (r * 0.42, h * 1.06)]
    bm = bmesh.new()
    seg = 16
    rr = [[bm.verts.new((pr * math.cos(2 * math.pi * i / seg) + x, pr * math.sin(2 * math.pi * i / seg) + y - 1.6, pz)) for i in range(seg)] for pr, pz in prof]
    for a in range(len(rr) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((rr[a][i], rr[a][j], rr[a + 1][j], rr[a + 1][i]))
    bm.faces.new(list(reversed(rr[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(to_obj(f'tent_jar{k}', bm, CLAY))
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.5)
bmesh.ops.scale(bm, vec=(1, 0.85, 1.2), verts=bm.verts)
bmesh.ops.translate(bm, vec=(-W + 1.1, -D - 1.0, 0.5), verts=bm.verts)
parts.append(to_obj('tent_sack', bm, mat('sack', '#c9b48a', 1.0)))
tent = join('home_tent', parts)  # 不叫 tent：同一個 .blend 裡民數記的場景已經有 tent，會被改名成 tent.001

# ================================================================ 排開來預覽、匯出

pot.location = (8, 0, 0)
lid.location = (8, 0, POT_RIM)
for k, s in enumerate(shards):
    s.location = s.location + Vector((10.5, 0, 0))
liz.location = (8, -2, 0.2)

for o in bpy.context.selected_objects:
    o.select_set(False)
export = [tent, pot, lid, liz] + shards
for o in export:
    o.select_set(True)
# 匯出前把預覽用的位置歸零（碎片保留它在罐子上的相對位置）
saved = {o.name: o.location.copy() for o in export}
tent.location = (0, 0, 0)
pot.location = (0, 0, 0)
lid.location = (0, 0, 0)
liz.location = (0, 0, 0)
for s in shards:
    s.location = s.location - Vector((10.5, 0, 0))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, use_active_scene=True,
                          export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
for o in export:
    o.location = saved[o.name]
print('exported', OUT, os.path.getsize(OUT), 'shards', len(shards))
