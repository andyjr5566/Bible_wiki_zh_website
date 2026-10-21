const youtubeFacadeWindow = window as Window & { __quartzYoutubeFacadeBound?: boolean }

if (!youtubeFacadeWindow.__quartzYoutubeFacadeBound) {
  youtubeFacadeWindow.__quartzYoutubeFacadeBound = true

  document.addEventListener("click", (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>(".yt-facade-play")
    if (!button) return

    const facade = button.closest<HTMLElement>(".yt-facade")
    const videoId = facade?.dataset.ytId
    if (!facade || !videoId) return

    const sourceParams = new URLSearchParams(facade.dataset.ytParams ?? "")
    const playbackParams = new URLSearchParams([["autoplay", "1"]])
    for (const [key, value] of sourceParams) {
      if (key !== "autoplay") playbackParams.append(key, value)
    }

    const iframe = document.createElement("iframe")
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${playbackParams.toString()}`
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture"
    iframe.allowFullscreen = true
    iframe.title = button.getAttribute("aria-label") ?? "YouTube 影片"
    iframe.setAttribute("frameborder", "0")
    facade.replaceChildren(iframe)
  })
}