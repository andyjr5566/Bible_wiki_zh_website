"""建立站的構圖契約；數值是整張畫布的百分比，順序即繪製順序。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def layer(name, source, scale=1, x=0, y=0, speed=3, role='scenery', key=None, actions=None, clip=None):
    item = dict(id=name, asset=name + '.webp', source=source, scale=scale, x=x, y=y,
                parallax=speed, role=role, actions=actions or [])
    if key:
        item['key'] = key
    if clip:
        item['clip'] = clip
    return item


def actor(station, name, scale=.55, x=-6, y=12, **kwargs):
    return layer(name, f'lab/assets-codex/{station}/{name}.png', scale, x, y, 7,
                 'person', 'magenta' if 'magenta' in name else 'white', **kwargs)


def action(prop, start, end, a, b):
    return dict(property=prop, start=start, end=end, **{'from': a, 'to': b})


stations = []


def station(id, beat, verses, weight, place, figures):
    bg = 'redsea-west' if id == 'redsea' else id
    middle = 'sea' if (ROOT / f'lab/renders/layers/{bg}/sea.png').exists() else 'mid'
    plates = [layer(f'{id}-{part}', f'lab/renders/layers/{bg}/{part}.png',
                    1.06 if part != 'near' else 1.1, speed=speed)
              for part, speed in [('sky', 1), ('far', 2), (middle, 3), ('near', 8)]]
    if id == 'redsea':
        plates[0]['actions'] = [action('brightness', .55, 1, .72, 1.15)]
    layers = plates[:3] + [f for f in figures if f['role'] != 'person'] + plates[3:] + [f for f in figures if f['role'] == 'person']
    if id == 'redsea':
        # 近岸與遠岸人物在前景地面之後，沿用已認可試作的遮擋次序。
        layers = plates[:3] + figures[:4] + plates[3:] + figures[4:]
    # 靈柩只在出埃及（出13:19）與抵達迦南兩處出現並附常駐說明；中間幕不重複，免得被當成約櫃。
    if id in ('egypt', 'canaan'):
        coffin = actor('shared', 'coffin-bearers', .095, 7, 17)
        coffin.update(role='coffin', parallax=5)
        layers.append(coffin)
    stations.append(dict(id=id, beat=beat, verses=verses, weight=weight, place=place,
                         still=.72 if id == 'redsea' else .5, layers=layers))


station('beyond-river', 'beat-06-beyond-river', [2], 1.3, 'haran', [
    layer('town-far', 'lab/assets-codex/beyond-river/town-far.png', .65, 15, -18, 2, key='white'),
    actor('beyond-river', 'terah-tent', .46, -8, 20)])
station('ford', 'beat-07-abraham', [3], 1.8, 'euphrates', [
    layer('flock-bank', 'lab/assets-gemini/ford/keyed/flock_bank.png', .9, 0, 4, 6),
    actor('test', 'abraham-wading', .48, -6, 17,
          actions=[action('x', 0, 1, -12, 3)]),
    layer('reeds-palms', 'lab/assets-gemini/ford/keyed/reeds_palms.png', 1.1, 0, 0, 9)])
station('isaac', 'beat-07-abraham', [3], 1.4, 'hebron', [actor('isaac', 'tent-baby', .43, -7, 17)])
station('esau-jacob', 'beat-07-abraham', [4], 1.8, 'egypt', [
    actor('esau-jacob', 'esau-seir', .4, 14, 0),
    actor('test', 'jacob-caravan', .44, -9, 15, actions=[action('x', 0, 1, -15, 1)])])
station('egypt', 'beat-08-egypt', [5], 1.6, 'rameses', [
    layer('pylon', 'lab/assets-codex/egypt/pylon.png', .66, 8, 3, 3, key='white'),
    actor('egypt', 'moses-aaron', .36, -13, 18)])
redsea = []
for side, sign in [('left', -1), ('right', 1)]:
    redsea.append(layer('water-' + side, 'lab/assets-gemini/redsea/keyed/water-walls.png',
        1.12, 0, 10, 4, actions=[action('x', .38, .72, sign*34, 0), action('y', .38, .72, 10, 2)],
        clip='inset(0 50% 0 0)' if side == 'left' else 'inset(0 0 0 50%)'))
redsea += [layer('chariots', 'lab/assets-gemini/redsea/keyed/chariots.png', .72, 0, 6, 5,
                 actions=[action('y', .45, .85, 6, 32), action('opacity', .78, .97, 1, 0)]),
           layer('darkness', 'lab/assets-gemini/redsea/keyed/darkness.png', 1.25, 0, -6, 3,
                 actions=[action('x', .55, 1, 0, -25), action('opacity', .55, 1, .95, .35)]),
           layer('far-crowd', 'lab/assets-gemini/redsea/keyed/far-crowd.png', 1.5, 0, 30, 7, 'person'),
           layer('near-family', 'lab/assets-gemini/redsea/keyed/near-family.png', .5, -20, 25, 10, 'person')]
station('redsea', 'beat-08-egypt', [6, 7], 4.6, 'redsea', redsea)
station('wilderness', 'beat-08-egypt', [7], 1.6, 'kadesh', [
    layer('camp', 'lab/assets-codex/wilderness/camp.png', .78, 0, 15, 4, key='white'),
    actor('wilderness', 'walkers', .46, -9, 18)])
station('east', 'beat-09-east', [8], 1.7, 'heshbon', [actor('east', 'battle', .72, 0, 8)])
station('moab', 'beat-09-east', [9, 10], 2, 'moab', [actor('moab', 'balak-balaam', .4, -9, 13)])
station('jordan', 'beat-10-jericho', [11, 12], 2.4, 'jericho', [
    layer('jericho-magenta', 'lab/assets-codex/jordan/jericho-magenta.png', .57, 15, -2, 3, key='magenta'),
    actor('jordan', 'crossing', .48, -12, 15, actions=[action('opacity', .4, .6, 1, 0)]),
    actor('jordan', 'swords-down', .45, -10, 15, actions=[action('opacity', .4, .6, 0, 1)])])
station('canaan', 'beat-11-gifts', [13], 2, 'shechem', [
    layer('towns-vines', 'lab/assets-codex/canaan/towns-vines.png', 1, 0, 2, 4, key='white')])
(ROOT / 'src/data/stations.json').write_text(json.dumps(stations, indent=2) + '\n', encoding='utf-8')
