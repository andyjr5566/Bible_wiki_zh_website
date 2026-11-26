// 截圖用：node e2e/shots.mjs <siteRoot> <profile> <shotDir>
// 桌機 1440、手機 390／375、深色；章節頁、展開書卷、條目頁、首頁、手機抽屜、手機章末、灰色提示。
import { startBrowser, sleep } from "../../personal-notes/e2e/lib.mjs"

const [root, profile, shotDir] = process.argv.slice(2)
const ch = (n) => "/" + encodeURI(`01-創世記/第${n}章`)
const entry = "/" + encodeURI("link_folder/人物/亞伯拉罕")

async function run(name, width, height, mobile, dark) {
  const s = await startBrowser({ root, profile: `${profile}/${name}`, width, height, mobile, shotDir })
  const { ev, go, shot, check, errors, send } = s
  await go("/index.html?skip=1", 3000)
  // 關掉首次導覽、序幕等
  await ev(`localStorage.setItem('bwz-tour-v2', JSON.stringify({v:2,status:'dismissed',step:0,skills:[],skipped:[]})); localStorage.setItem('pwa_install_guide_dismissed_v1','1')`)
  await ev(`localStorage.setItem('theme','${dark ? "dark" : "light"}')`)
  const t = dark ? "-dark" : ""
  await go(ch(2), 3500)
  await shot(`${name}-chapter${t}`)
  console.log(name, "overflow-x:", await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`))
  if (!mobile) {
    await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(300)
    await shot(`${name}-books-open${t}`)
    await go(entry, 3500)
    await shot(`${name}-entry${t}`)
    await ev(`document.querySelector('.bwz-bg-book.is-locked').click()`); await sleep(500)
    await shot(`${name}-toast${t}`)
    await go("/index.html?skip=1", 3500)
    await shot(`${name}-home${t}`)
  } else {
    await ev(`document.querySelector('.explorer-toggle.mobile-explorer').click()`); await sleep(900)
    await shot(`${name}-drawer${t}`)
    await ev(`document.querySelector('.bwz-pk-switch').click()`); await sleep(300)
    await shot(`${name}-drawer-books${t}`)
    await go(ch(2), 3500)
    await ev(`document.querySelector('.bwz-chend').scrollIntoView({block:'center'})`); await sleep(500)
    await shot(`${name}-chend${t}`)
  }
  console.log(name, "errors:", JSON.stringify(errors))
  s.finish = null
  await send("Browser.close").catch(() => {})
}
const [which] = [process.argv[5]]
const specs = {
  d1440: [1440, 900, false, false],
  d1440dark: [1440, 900, false, true],
  m390: [390, 844, true, false],
  m390dark: [390, 844, true, true],
  m375: [375, 812, true, false],
}
for (const [n, a] of Object.entries(specs)) if (!which || which === n) await run(n, ...a)
process.exit(0)
