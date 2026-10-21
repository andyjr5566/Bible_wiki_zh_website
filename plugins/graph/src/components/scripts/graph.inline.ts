// @ts-nocheck
import {
  categorizeGraphSlug,
  distributeSectorAngles,
  getMoreCount,
  groupNeighbors,
} from "../graph-layout";
import {
  estimateTextWidth,
  layoutCategoryFan,
  placeNodeLabels,
  placeSectorLabels,
} from "../graph-geometry";
import {
  removeAllChildren,
  getBasePath,
  getFullSlugFromUrl,
  simplifySlug,
  resolveBasePath,
} from "@quartz-community/utils";

(function () {
  function getSlugFromUrl() {
    if (typeof document !== "undefined" && document.body && document.body.dataset && document.body.dataset.slug) {
      try {
        return decodeURIComponent(document.body.dataset.slug);
      } catch (e) {
        return document.body.dataset.slug;
      }
    }
    var slug = getFullSlugFromUrl();
    var base = getBasePath();
    if (base && slug.startsWith(base.replace(/^\//, ""))) {
      slug = slug.slice(base.replace(/^\//, "").length);
      if (slug.startsWith("/")) slug = slug.slice(1);
    }
    try {
      slug = decodeURIComponent(slug);
    } catch (e) {}
    return slug;
  }

  function loadScript(src) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  Promise.all([loadScript("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js")])
    .then(function () {
      initGraph();
    })
    .catch(function (err) {
      console.error("[Graph] Failed to load libraries:", err);
      var containers = document.querySelectorAll(".graph-container");
      for (var i = 0; i < containers.length; i++) {
        containers[i].textContent = "Graph could not load. Check your network connection.";
        containers[i].style.display = "flex";
        containers[i].style.alignItems = "center";
        containers[i].style.justifyContent = "center";
        containers[i].style.color = "var(--gray)";
        containers[i].style.fontSize = "0.9rem";
      }
    });

  function initGraph() {
    var d3 = window.d3;

    if (!d3) {
      console.error("[Graph] Libraries not loaded");
      return;
    }

    var localStorageKey = "graph-visited";

    function getVisited() {
      return new Set(JSON.parse(localStorage.getItem(localStorageKey) || "[]"));
    }

    function addToVisited(slug) {
      var visited = getVisited();
      visited.add(slug);
      localStorage.setItem(localStorageKey, JSON.stringify(Array.from(visited)));
    }

    // Resolves CSS color values containing calc()/var() that PixiJS cannot parse.
    // Uses a temp DOM element so the browser's CSS engine evaluates the expression.
    function resolveColor(value, fallback) {
      if (!value) return fallback;
      var el = document.createElement("div");
      el.style.color = value;
      el.style.position = "absolute";
      el.style.visibility = "hidden";
      document.body.appendChild(el);
      var resolved = getComputedStyle(el).color;
      el.remove();
      return resolved || fallback;
    }


  function isDarkPalette(styles) {
    var lightToken = resolveColor(styles.getPropertyValue("--light").trim(), "#f5f5f5");
    var rgb = lightToken.match(/[\d.]+/g);
    return !!rgb && rgb.length >= 3 && (Number(rgb[0]) * 0.2126 + Number(rgb[1]) * 0.7152 + Number(rgb[2]) * 0.0722) < 128;
  }

  // One palette (color + shape per category) shared by the small fan, the list and the expanded graph.
  function buildPalette(styles) {
    var isDarkTheme = isDarkPalette(styles);
    return {
      "章節": { color: isDarkTheme ? "#e7e5e4" : "#44403c", shape: "ring" },
      "人物": { color: isDarkTheme ? "#fbbf24" : "#b45309", shape: "circle" },
      "地點": { color: isDarkTheme ? "#4ade80" : "#15803d", shape: "square" },
      "歷史": { color: isDarkTheme ? "#f87171" : "#b91c1c", shape: "diamond" },
      "神學": { color: isDarkTheme ? "#c4b5fd" : "#6d28d9", shape: "triangle" },
      "原文": { color: isDarkTheme ? "#7dd3fc" : "#0369a1", shape: "hex" },
      "其他": { color: isDarkTheme ? "#a8a29e" : "#78716c", shape: "circle" },
    };
  }

  function measureText(textElement, fallbackText, fontSize, bold) {
    try {
      var box = textElement.getBBox();
      if (box && box.width > 0) return box.width;
    } catch (e) {}
    return estimateTextWidth(fallbackText, fontSize, bold);
  }

  function createSvgElement(tag, attributes) {
    var element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var key in attributes) element.setAttribute(key, String(attributes[key]));
    return element;
  }

  function drawCategoryShape(parent, category, x, y, radius, color, palette) {
    var shape = palette[category].shape;
    var element;
    if (shape === "ring") {
      element = createSvgElement("circle", { cx: x, cy: y, r: radius, fill: "none", stroke: color, "stroke-width": 1.8 });
    } else if (shape === "square") {
      element = createSvgElement("rect", { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, rx: 1.5, fill: color });
    } else if (shape === "diamond") {
      element = createSvgElement("path", { d: "M" + x + " " + (y - radius * 1.25) + "L" + (x + radius * 1.25) + " " + y + "L" + x + " " + (y + radius * 1.25) + "L" + (x - radius * 1.25) + " " + y + "Z", fill: color });
    } else if (shape === "triangle") {
      element = createSvgElement("path", { d: "M" + x + " " + (y - radius * 1.3) + "L" + (x + radius * 1.2) + " " + (y + radius * 0.9) + "L" + (x - radius * 1.2) + " " + (y + radius * 0.9) + "Z", fill: color });
    } else if (shape === "hex") {
      var points = [];
      for (var i = 0; i < 6; i++) {
        var angle = (Math.PI / 3) * i;
        points.push((x + radius * 1.15 * Math.cos(angle)).toFixed(1) + "," + (y + radius * 1.15 * Math.sin(angle)).toFixed(1));
      }
      element = createSvgElement("polygon", { points: points.join(" "), fill: color });
    } else {
      element = createSvgElement("circle", { cx: x, cy: y, r: radius, fill: color });
    }
    parent.appendChild(element);
    return element;
  }

  function renderCategorizedLocalGraph(graph, slug, nodes, width, height, styles) {
    var wrapper = graph.closest(".graph");
    var list = wrapper ? wrapper.querySelector(".graph-category-list") : null;
    if (!list) return function () {};

    var palette = buildPalette(styles);
    var centerNode = null;
    var neighbors = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === slug) centerNode = nodes[i];
      else neighbors.push(nodes[i]);
    }
    var groups = groupNeighbors(neighbors);
    var groupMap = new Map();
    var counts = {};
    for (var i = 0; i < groups.length; i++) {
      groupMap.set(groups[i].category, groups[i].items);
      counts[groups[i].category] = groups[i].items.length;
    }

    var svg = createSvgElement("svg", {
      "class": "graph-sector-svg",
      width: width,
      height: height,
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": "依分類排列的相關條目圖譜",
    });
    graph.appendChild(svg);
    var centerX = width / 2;
    var centerY = height / 2;
    var outerRadius = Math.max(24, Math.min(width, height) / 2 - 27);
    var nodeRadius = Math.max(2.8, Math.min(4.2, Math.min(width, height) * 0.016));
    var sectors = distributeSectorAngles(counts);
    var nodeElements = new Map();
    var nodeRects = [];

    for (var si = 0; si < sectors.length; si++) {
      var sector = sectors[si];
      var items = groupMap.get(sector.category) || [];
      var ringCount = items.length < 5 ? 2 : 3;
      var radii = ringCount === 2 ? [outerRadius * 0.76, outerRadius] : [outerRadius * 0.7, outerRadius * 0.85, outerRadius];
      for (var ni = 0; ni < items.length; ni++) {
        var angle = sector.startAngle + sector.angle * ((ni + 0.5) / items.length);
        var radius = radii[ni % ringCount];
        var x = centerX + radius * Math.cos(angle);
        var y = centerY + radius * Math.sin(angle);
        svg.appendChild(createSvgElement("line", {
          x1: centerX, y1: centerY, x2: x, y2: y,
          stroke: palette[sector.category].color, "stroke-opacity": 0.24, "stroke-width": 1,
          "pointer-events": "none",
        }));
      }
    }

    for (var si = 0; si < sectors.length; si++) {
      var sector = sectors[si];
      var items = groupMap.get(sector.category) || [];
      var ringCount = items.length < 5 ? 2 : 3;
      var radii = ringCount === 2 ? [outerRadius * 0.76, outerRadius] : [outerRadius * 0.7, outerRadius * 0.85, outerRadius];
      for (var ni = 0; ni < items.length; ni++) {
        var item = items[ni];
        var angle = sector.startAngle + sector.angle * ((ni + 0.5) / items.length);
        var radius = radii[ni % ringCount];
        var x = centerX + radius * Math.cos(angle);
        var y = centerY + radius * Math.sin(angle);
        var color = palette[sector.category].color;
        nodeRects.push({ x: x - 6, y: y - 6, width: 12, height: 12 });
        var group = createSvgElement("g", {
          "class": "graph-sector-node",
          "data-node-id": item.id,
          role: "link",
          tabindex: "0",
          "aria-label": item.text,
          "data-x": x,
          "data-y": y,
        });
        group.appendChild(createSvgElement("title", {})).textContent = item.text;
        drawCategoryShape(group, sector.category, x, y, nodeRadius, color, palette);
        var labelText = createSvgElement("text", {
          "class": "graph-sector-node-label",
          x: Math.max(34, Math.min(width - 34, x)),
          y: Math.max(12, Math.min(height - 6, y - 8)),
          "text-anchor": "middle",
        });
        labelText.textContent = item.text;
        group.appendChild(labelText);
        group.addEventListener("pointerenter", function () {
          this.classList.add("is-highlighted");
        });
        group.addEventListener("pointerleave", function () {
          this.classList.remove("is-highlighted");
        });
        var navigate = function (targetId) {
          var target = resolveBasePath(targetId);
          var url = new URL(target, window.location.toString());
          if (window.spaNavigate) window.spaNavigate(url);
          else window.location.assign(url);
        };
        (function (nodeId, nodeGroup, navigateTo) {
          nodeGroup.addEventListener("click", function () { navigateTo(nodeId); });
          nodeGroup.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigateTo(nodeId);
            }
          });
        })(item.id, group, navigate);
        svg.appendChild(group);
        try {
          var nodeLabelBounds = labelText.getBBox();
          var labelDx = nodeLabelBounds.x < 2 ? 2 - nodeLabelBounds.x : (nodeLabelBounds.x + nodeLabelBounds.width > width - 2 ? width - 2 - nodeLabelBounds.x - nodeLabelBounds.width : 0);
          var labelDy = nodeLabelBounds.y < 10 ? 10 - nodeLabelBounds.y : (nodeLabelBounds.y + nodeLabelBounds.height > height - 2 ? height - 2 - nodeLabelBounds.y - nodeLabelBounds.height : 0);
          if (labelDx) labelText.setAttribute("x", Number(labelText.getAttribute("x")) + labelDx);
          if (labelDy) labelText.setAttribute("y", Number(labelText.getAttribute("y")) + labelDy);
        } catch (e) {}
        nodeElements.set(item.id, group);
      }

    }

    var centerColor = resolveColor(styles.getPropertyValue("--secondary").trim(), "#c792ea");
    svg.appendChild(createSvgElement("circle", { cx: centerX, cy: centerY, r: 8, fill: centerColor, "class": "graph-sector-center" }));
    var centerTitle = centerNode ? centerNode.text : (slug === "index" || slug === "/" ? "首頁" : slug.split("/").pop());
    var centerLabel = createSvgElement("text", {
      "class": "graph-sector-center-label",
      x: centerX,
      y: Math.min(height - 5, centerY + 23),
      "text-anchor": "middle",
    });
    centerLabel.textContent = centerTitle.length > 12 ? centerTitle.slice(0, 11) + "…" : centerTitle;
    svg.appendChild(centerLabel);
    var centerLabelWidth = measureText(centerLabel, centerLabel.textContent, 10, true);
    var centerLabelBox = { x: centerX - centerLabelWidth / 2 - 2, y: Math.min(height - 5, centerY + 23) - 11, width: centerLabelWidth + 4, height: 14 };

    // Sector labels: measured, then pushed apart so that no two boxes overlap. If they still
    // cannot fit, fall back to a legend row under the graph.
    var sectorLabelInputs = [];
    var sectorLabelElements = new Map();
    for (var si = 0; si < sectors.length; si++) {
      var labelSector = sectors[si];
      var labelCount = (groupMap.get(labelSector.category) || []).length;
      var sectorLabelValue = labelSector.category + " " + labelCount;
      var categoryLabel = createSvgElement("text", {
        "class": "graph-sector-label",
        x: 0,
        y: 0,
        fill: palette[labelSector.category].color,
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      categoryLabel.textContent = sectorLabelValue;
      svg.appendChild(categoryLabel);
      sectorLabelElements.set(labelSector.category, categoryLabel);
      sectorLabelInputs.push({
        key: labelSector.category,
        angle: labelSector.startAngle + labelSector.angle / 2,
        width: measureText(categoryLabel, sectorLabelValue, 12, true) + 4,
        height: 16,
        weight: labelCount,
      });
    }
    var placement = placeSectorLabels(sectorLabelInputs, {
      cx: centerX,
      cy: centerY,
      radius: outerRadius,
      gap: 6,
      bounds: { width: width, height: height, margin: 2 },
      obstacles: nodeRects.concat([
        { x: width - 34, y: 0, width: 34, height: 34 },
        centerLabelBox,
      ]),
    });
    var legendRow = null;
    if (placement.fits) {
      placement.labels.forEach(function (placed, labelIndex) {
        var element = sectorLabelElements.get(placed.key);
        element.setAttribute("x", placed.rect.x + placed.rect.width / 2);
        element.setAttribute("y", placed.rect.y + placed.rect.height / 2);
        if (placed.moved) {
          var angleOfLabel = sectorLabelInputs[labelIndex].angle;
          var leaderFromX = centerX + (outerRadius + 4) * Math.cos(angleOfLabel);
          var leaderFromY = centerY + (outerRadius + 4) * Math.sin(angleOfLabel);
          svg.insertBefore(createSvgElement("line", {
            x1: leaderFromX,
            y1: leaderFromY,
            x2: Math.max(placed.rect.x, Math.min(placed.rect.x + placed.rect.width, leaderFromX)),
            y2: Math.max(placed.rect.y, Math.min(placed.rect.y + placed.rect.height, leaderFromY)),
            stroke: palette[placed.key].color,
            "stroke-opacity": 0.5,
            "stroke-width": 1,
            "pointer-events": "none",
          }), element);
        }
      });
    } else {
      sectorLabelElements.forEach(function (element) { element.remove(); });
      legendRow = document.createElement("div");
      legendRow.className = "graph-sector-legend";
      sectors.forEach(function (legendSector) {
        var entry = document.createElement("span");
        var legendIcon = createSvgElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" });
        drawCategoryShape(legendIcon, legendSector.category, 7, 7, 4.2, palette[legendSector.category].color, palette);
        entry.appendChild(legendIcon);
        entry.appendChild(document.createTextNode(legendSector.category + " " + (groupMap.get(legendSector.category) || []).length));
        legendRow.appendChild(entry);
      });
      var legendAnchor = graph.closest(".graph-outer") || graph;
      legendAnchor.insertAdjacentElement("afterend", legendRow);
    }

    var expanded = new Set();
    function focusNode(id, enabled) {
      var node = nodeElements.get(id);
      if (!node) return;
      if (enabled) {
        node.classList.add("is-highlighted");
      } else {
        node.classList.remove("is-highlighted");
      }
    }
    function renderList() {
      list.replaceChildren();
      if (neighbors.length === 0) {
        var empty = document.createElement("p");
        empty.className = "graph-empty-message";
        empty.textContent = "這一頁還沒有相關條目";
        list.appendChild(empty);
        return;
      }
      groups.forEach(function (group) {
        var section = document.createElement("section");
        section.className = "graph-category-group";
        section.dataset.category = group.category;
        var heading = document.createElement("div");
        heading.className = "graph-category-heading";
        var icon = createSvgElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" });
        drawCategoryShape(icon, group.category, 7, 7, 4.2, palette[group.category].color, palette);
        heading.appendChild(icon);
        var name = document.createElement("span");
        name.textContent = group.category;
        heading.appendChild(name);
        var count = document.createElement("span");
        count.className = "graph-category-count";
        count.textContent = String(group.items.length);
        heading.appendChild(count);
        section.appendChild(heading);

        var entries = document.createElement("div");
        entries.className = "graph-category-items";
        var isExpanded = expanded.has(group.category);
        var shown = isExpanded ? group.items : group.items.slice(0, 4);
        shown.forEach(function (item) {
          var anchor = document.createElement("a");
          anchor.className = "internal graph-category-link";
          anchor.href = resolveBasePath(item.id);
          anchor.dataset.nodeId = item.id;
          anchor.textContent = item.text;
          anchor.title = item.text;
          entries.appendChild(anchor);
        });
        var remaining = getMoreCount(group.items.length);
        if (remaining > 0) {
          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "graph-category-toggle";
          toggle.dataset.expandCategory = group.category;
          toggle.setAttribute("aria-expanded", String(isExpanded));
          toggle.textContent = isExpanded ? "收起" : "＋" + remaining;
          entries.appendChild(toggle);
        }
        section.appendChild(entries);
        list.appendChild(section);
      });
    }
    var onListClick = function (event) {
      var toggle = event.target.closest("button[data-expand-category]");
      if (!toggle || !list.contains(toggle)) return;
      var category = toggle.dataset.expandCategory;
      if (expanded.has(category)) expanded.delete(category);
      else expanded.add(category);
      renderList();
    };
    var onListOver = function (event) {
      var anchor = event.target.closest("a[data-node-id]");
      if (anchor && list.contains(anchor)) focusNode(anchor.dataset.nodeId, true);
    };
    var onListOut = function (event) {
      var anchor = event.target.closest("a[data-node-id]");
      if (anchor && list.contains(anchor) && (!event.relatedTarget || !anchor.contains(event.relatedTarget))) focusNode(anchor.dataset.nodeId, false);
    };
    list.addEventListener("click", onListClick);
    list.addEventListener("mouseover", onListOver);
    list.addEventListener("mouseout", onListOut);
    renderList();
    return function () {
      list.removeEventListener("click", onListClick);
      list.removeEventListener("mouseover", onListOver);
      list.removeEventListener("mouseout", onListOut);
      list.replaceChildren();
      if (legendRow) legendRow.remove();
    };
  }

  function truncateLabel(text, maxChars) {
    var chars = Array.from(text);
    return chars.length > maxChars ? chars.slice(0, maxChars - 1).join("") + "…" : text;
  }

  // Expanded graph: the same category shapes/colors as the small fan, laid out as a bigger fan.
  // Positions come from a fixed number of deterministic passes (see layoutCategoryFan), so nothing
  // keeps simulating; dragging simply moves a node. Node name labels are re-placed after every
  // pan/zoom/drag with a greedy collision check, and the ones that do not fit appear on hover.
  function renderCategorizedModalGraph(graph, slug, nodes, graphLinks, width, height, styles, env) {
    var palette = buildPalette(styles);
    var accent = resolveColor(styles.getPropertyValue("--secondary").trim(), "#c792ea");
    var visitedColor = resolveColor(styles.getPropertyValue("--tertiary").trim(), "#82aaff");
    var narrow = width < 560;
    var labelFont = narrow ? 11 : 12;
    var labelHeight = labelFont + 5;
    var maxChars = narrow ? 8 : 13;

    var centerNode = null;
    var neighbors = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === slug) centerNode = nodes[i];
      else neighbors.push(nodes[i]);
    }
    var groups = groupNeighbors(neighbors);
    var counts = {};
    for (var gi = 0; gi < groups.length; gi++) counts[groups[gi].category] = groups[gi].items.length;

    var svg = createSvgElement("svg", {
      "class": "graph-modal-svg",
      width: width,
      height: height,
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": "依分類排列的相關條目圖譜（放大）",
    });
    graph.appendChild(svg);

    var legend = document.createElement("div");
    legend.className = "graph-modal-legend";
    var centerEntry = document.createElement("span");
    var centerIcon = createSvgElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" });
    centerIcon.appendChild(createSvgElement("circle", { cx: 7, cy: 7, r: 5, fill: accent }));
    centerEntry.appendChild(centerIcon);
    centerEntry.appendChild(document.createTextNode("目前頁面"));
    legend.appendChild(centerEntry);
    groups.forEach(function (group) {
      var entry = document.createElement("span");
      var icon = createSvgElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" });
      drawCategoryShape(icon, group.category, 7, 7, 4.4, palette[group.category].color, palette);
      entry.appendChild(icon);
      entry.appendChild(document.createTextNode(group.category));
      legend.appendChild(entry);
    });
    graph.appendChild(legend);
    var areaH = Math.max(160, height - legend.offsetHeight - 10);

    var measurer = createSvgElement("text", { x: 0, y: 0, visibility: "hidden", "font-size": labelFont });
    svg.appendChild(measurer);
    var widthCache = new Map();
    function textWidth(text, size, bold) {
      var key = text + "|" + size + "|" + bold;
      var cached = widthCache.get(key);
      if (cached !== undefined) return cached;
      measurer.setAttribute("font-size", size);
      measurer.setAttribute("font-weight", bold ? 700 : 400);
      measurer.textContent = text;
      var value = measureText(measurer, text, size, bold);
      widthCache.set(key, value);
      return value;
    }

    var cx = width / 2;
    var cy = areaH / 2;
    var centerR = env.radiusOf(centerNode || { id: slug });
    var centerTitle = centerNode ? centerNode.text : (slug === "index" || slug === "/" ? "首頁" : slug.split("/").pop());
    var centerLabelText = truncateLabel(centerTitle, narrow ? 10 : 16);
    var centerLabelWidth = textWidth(centerLabelText, labelFont + 1, true) + 2;
    var centerHalfW = Math.max(centerR, centerLabelWidth / 2) + 4;
    var centerBox = { x: cx - centerHalfW, y: cy - centerR - 4, width: centerHalfW * 2, height: centerR * 2 + labelHeight + 10 };

    var layoutNodes = neighbors.map(function (node) {
      return {
        id: node.id,
        category: categorizeGraphSlug(node.id),
        r: env.radiusOf(node),
        labelWidth: textWidth(truncateLabel(node.text, maxChars), labelFont, false) + 2,
      };
    });
    var layout = layoutCategoryFan(layoutNodes, {
      width: width,
      height: areaH,
      labelHeight: labelHeight,
      obstacles: [centerBox],
    });

    // Cluster labels (「類型 數量」) sit just beyond the far end of each cluster, clear of every node box.
    var sectors = layout.sectors;
    var nodeBoxes = [centerBox];
    var clusterReach = {};
    layoutNodes.forEach(function (layoutNode) {
      var position = layout.positions.get(layoutNode.id);
      var boxWidth = Math.max(layoutNode.r * 2, layoutNode.labelWidth);
      nodeBoxes.push({ x: position.x - boxWidth / 2, y: position.y - layoutNode.r, width: boxWidth, height: layoutNode.r * 2 + 2 + labelHeight });
      var normalized = Math.sqrt(Math.pow((position.x - cx) / layout.radii.rx, 2) + Math.pow((position.y - cy) / layout.radii.ry, 2));
      clusterReach[layoutNode.category] = Math.max(clusterReach[layoutNode.category] || 0, normalized);
    });
    var clusterInputs = sectors.map(function (sector) {
      var text = sector.category + " " + counts[sector.category];
      return {
        key: sector.category,
        text: text,
        angle: sector.startAngle + sector.angle / 2,
        width: textWidth(text, labelFont + 1, true) + 6,
        height: labelHeight + 2,
        weight: counts[sector.category],
        scale: Math.max(0.5, clusterReach[sector.category] || 1),
      };
    });
    var clusterPlacement = placeSectorLabels(clusterInputs, {
      cx: cx,
      cy: cy,
      rx: layout.radii.rx,
      ry: layout.radii.ry,
      gap: labelHeight + 4,
      bounds: { width: width, height: areaH, margin: 4 },
      obstacles: nodeBoxes,
    });
    var categoryOf = new Map();
    layoutNodes.forEach(function (layoutNode) { categoryOf.set(layoutNode.id, layoutNode.category); });
    nodes.forEach(function (node) {
      if (node === centerNode) {
        node.x = cx;
        node.y = cy;
      } else {
        var position = layout.positions.get(node.id);
        node.x = position ? position.x : cx;
        node.y = position ? position.y : cy;
      }
    });

    var zoomLayer = createSvgElement("g", { "class": "graph-modal-zoom" });
    svg.appendChild(zoomLayer);
    var overlay = createSvgElement("g", { "class": "graph-modal-overlay" });
    svg.appendChild(overlay);

    var adjacency = new Map();
    function connect(a, b) {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a).add(b);
    }
    var linkLayer = createSvgElement("g", { "class": "graph-modal-links" });
    zoomLayer.appendChild(linkLayer);
    var linkEls = [];
    var seenLinks = new Set();
    graphLinks.forEach(function (link) {
      var a = link.source.id;
      var b = link.target.id;
      var key = a < b ? a + "\n" + b : b + "\n" + a;
      if (a === b || seenLinks.has(key)) return;
      seenLinks.add(key);
      connect(a, b);
      connect(b, a);
      var touchesCenter = a === slug || b === slug;
      var other = a === slug ? b : a;
      var element = createSvgElement("line", {
        "class": "graph-modal-link",
        stroke: touchesCenter && categoryOf.has(other) ? palette[categoryOf.get(other)].color : "var(--gray)",
        "stroke-opacity": touchesCenter ? 0.34 : 0.22,
        "stroke-width": touchesCenter ? 1.2 : 1,
        "pointer-events": "none",
      });
      linkLayer.appendChild(element);
      linkEls.push({ el: element, a: link.source, b: link.target, base: touchesCenter ? 0.34 : 0.22 });
    });

    var nodeEls = new Map();
    var labelEls = new Map();
    var hoverId = null;
    var transform = d3.zoomIdentity;
    var frame = 0;

    function navigateTo(targetId) {
      env.closeModal();
      var target = resolveBasePath(targetId);
      var url = new URL(target, window.location.toString());
      if (window.spaNavigate) window.spaNavigate(url);
      else window.location.assign(url);
    }

    nodes.forEach(function (node) {
      var isCenter = node.id === slug;
      var category = isCenter ? null : categoryOf.get(node.id);
      var r = env.radiusOf(node);
      var group = createSvgElement("g", {
        "class": "graph-modal-node" + (isCenter ? " is-current" : ""),
        "data-node-id": node.id,
        role: "link",
        tabindex: "0",
        "aria-label": node.text,
        transform: "translate(" + node.x + " " + node.y + ")",
      });
      group.appendChild(createSvgElement("title", {})).textContent = node.text;
      group.appendChild(createSvgElement("circle", { cx: 0, cy: 0, r: r + 7, fill: "transparent" }));
      if (isCenter) {
        group.appendChild(createSvgElement("circle", { cx: 0, cy: 0, r: r + 3, fill: "none", stroke: accent, "stroke-opacity": 0.45, "stroke-width": 2 }));
        group.appendChild(createSvgElement("circle", { cx: 0, cy: 0, r: r, fill: accent }));
      } else {
        if (env.visited.has(node.id)) {
          group.appendChild(createSvgElement("circle", { cx: 0, cy: 0, r: r + 4, fill: "none", stroke: visitedColor, "stroke-opacity": 0.85, "stroke-width": 1.4, "class": "graph-modal-visited" }));
        }
        drawCategoryShape(group, category, 0, 0, r, palette[category].color, palette);
      }
      zoomLayer.appendChild(group);
      nodeEls.set(node.id, group);
      group.addEventListener("pointerenter", function () { setHover(node.id); });
      group.addEventListener("pointerleave", function () { setHover(null); });
      group.addEventListener("focus", function () { setHover(node.id); });
      group.addEventListener("blur", function () { setHover(null); });
      group.addEventListener("click", function () { navigateTo(node.id); });
      group.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigateTo(node.id);
        }
      });

      var label = createSvgElement("text", {
        "class": "graph-modal-node-label" + (isCenter ? " is-current" : ""),
        x: 0,
        y: 0,
        "dominant-baseline": "central",
        "font-size": isCenter ? labelFont + 1 : labelFont,
        visibility: "hidden",
      });
      label.textContent = isCenter ? centerLabelText : truncateLabel(node.text, maxChars);
      overlay.appendChild(label);
      labelEls.set(node.id, label);
    });

    var clusterEls = clusterPlacement.labels.map(function (placed, index) {
      var input = clusterInputs[index];
      var element = createSvgElement("text", {
        "class": "graph-modal-cluster-label",
        "font-size": labelFont + 1,
        fill: palette[input.key].color,
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      element.textContent = input.text;
      overlay.appendChild(element);
      return { el: element, rect: placed.rect };
    });

    function screenX(x) { return transform.x + transform.k * x; }
    function screenY(y) { return transform.y + transform.k * y; }

    function updateLabels() {
      frame = 0;
      var obstacles = [];
      clusterEls.forEach(function (cluster) {
        var rect = {
          x: screenX(cluster.rect.x + cluster.rect.width / 2) - cluster.rect.width / 2,
          y: screenY(cluster.rect.y + cluster.rect.height / 2) - cluster.rect.height / 2,
          width: cluster.rect.width,
          height: cluster.rect.height,
        };
        obstacles.push(rect);
        cluster.el.setAttribute("x", rect.x + rect.width / 2);
        cluster.el.setAttribute("y", rect.y + rect.height / 2);
      });

      // Priority: current page, hovered node, then shorter names first (more labels fit).
      var ordered = neighbors
        .filter(function (node) { return node.id !== hoverId; })
        .sort(function (a, b) { return Array.from(a.text).length - Array.from(b.text).length; });
      var queue = [];
      if (centerNode) queue.push(centerNode);
      if (hoverId && hoverId !== slug) {
        var hoveredNode = nodes.find(function (node) { return node.id === hoverId; });
        if (hoveredNode) queue.push(hoveredNode);
      }
      queue = queue.concat(ordered);

      var items = queue.map(function (node) {
        var isCenter = node === centerNode;
        var isHover = node.id === hoverId;
        var value = isHover ? node.text : (isCenter ? centerLabelText : truncateLabel(node.text, maxChars));
        var outward = node.x >= cx ? "right" : "left";
        var inward = outward === "right" ? "left" : "right";
        return {
          id: node.id,
          x: screenX(node.x),
          y: screenY(node.y),
          r: env.radiusOf(node) * transform.k * (isCenter ? 1.15 : 1.3),
          width: textWidth(value, isCenter ? labelFont + 1 : labelFont, isCenter || isHover) + 2,
          height: labelHeight,
          sides: isCenter ? ["below", "above", "right", "left"] : ["below", outward, "above", inward],
          force: isCenter || isHover,
          text: value,
        };
      });
      var placed = placeNodeLabels(items, { width: width, height: areaH, margin: 2, obstacles: obstacles });
      labelEls.forEach(function (element, id) {
        if (!placed.has(id)) element.setAttribute("visibility", "hidden");
      });
      items.forEach(function (item) {
        var spot = placed.get(item.id);
        if (!spot) return;
        var element = labelEls.get(item.id);
        if (element.textContent !== item.text) element.textContent = item.text;
        element.setAttribute("x", spot.rect.x + 1);
        element.setAttribute("y", spot.rect.y + spot.rect.height / 2);
        element.setAttribute("visibility", "visible");
        element.classList.toggle("is-hover", item.id === hoverId);
      });
    }

    function scheduleLabels() {
      if (!frame) frame = requestAnimationFrame(updateLabels);
    }

    function setHover(id) {
      hoverId = id;
      var near = id ? adjacency.get(id) : null;
      nodeEls.forEach(function (element, nodeId) {
        var dim = !!id && env.focusOnHover && nodeId !== id && !(near && near.has(nodeId));
        element.classList.toggle("is-dim", dim);
      });
      linkEls.forEach(function (link) {
        var active = !!id && (link.a.id === id || link.b.id === id);
        link.el.setAttribute("stroke-opacity", active ? 0.9 : (id && env.focusOnHover ? 0.06 : link.base));
        link.el.setAttribute("stroke-width", active ? 2 : 1);
      });
      updateLabels();
    }

    function positionLinks() {
      linkEls.forEach(function (link) {
        link.el.setAttribute("x1", link.a.x);
        link.el.setAttribute("y1", link.a.y);
        link.el.setAttribute("x2", link.b.x);
        link.el.setAttribute("y2", link.b.y);
      });
    }
    positionLinks();

    if (env.enableDrag) {
      var drag = d3
        .drag()
        .container(zoomLayer)
        .subject(function (event, d) { return { x: d.x, y: d.y }; })
        .on("drag", function (event, d) {
          d.x = event.x;
          d.y = event.y;
          nodeEls.get(d.id).setAttribute("transform", "translate(" + d.x + " " + d.y + ")");
          positionLinks();
          scheduleLabels();
        });
      nodes.forEach(function (node) {
        d3.select(nodeEls.get(node.id)).datum(node).call(drag);
      });
    }

    if (env.enableZoom) {
      var zoom = d3
        .zoom()
        .extent([[0, 0], [width, areaH]])
        .scaleExtent([0.5, 4])
        .on("zoom", function (event) {
          transform = event.transform;
          zoomLayer.setAttribute("transform", transform.toString());
          scheduleLabels();
        });
      d3.select(svg).call(zoom);
    }

    updateLabels();

    return function () {
      if (frame) cancelAnimationFrame(frame);
      svg.remove();
      legend.remove();
    };
  }

    async function renderGraph(graph, fullSlug, renderGeneration) {
      var decodedFullSlug = fullSlug;
      try {
        decodedFullSlug = decodeURIComponent(fullSlug);
      } catch (e) {}
      var slug = simplifySlug(decodedFullSlug);
      if (slug === "") slug = "index";
      var visited = getVisited();
      removeAllChildren(graph);

      if (renderGeneration !== undefined && renderGeneration !== currentRenderGeneration) {
        console.log("[Graph] Stale render, skipping");
        return function () {};
      }

      var config = JSON.parse(graph.dataset["cfg"] || "{}");
      var enableDrag = config.drag;
      var enableZoom = config.zoom;
      var depth = config.depth;
      var scale = config.scale || 1;
      var repelForce = config.repelForce || 0.5;
      var centerForce = config.centerForce || 0.3;
      var linkDistance = config.linkDistance || 30;
      var fontSize = config.fontSize || 0.6;
      var opacityScale = config.opacityScale || 1;
      var removeTags = config.removeTags || [];
      var showTags = config.showTags;
      var focusOnHover = config.focusOnHover;
      var enableRadial = config.enableRadial;

      var data;
      try {
        var dataRaw = await fetchData;
        data = new Map();
        for (var key in dataRaw) {
          var decodedKey = key;
          try {
            decodedKey = decodeURIComponent(key);
          } catch (e) {}
          data.set(simplifySlug(decodedKey), dataRaw[key]);
        }
      } catch (err) {
        console.error("[Graph] Error loading data:", err);
        return function () {};
      }

      if (renderGeneration !== undefined && renderGeneration !== currentRenderGeneration) {
        return function () {};
      }

      var isGlobal = graph.classList.contains("global-graph-container");
      var rect = graph.getBoundingClientRect();
      var width = graph.offsetWidth || Math.round(rect.width) || (isGlobal ? Math.round(window.innerWidth * 0.85) : 250);
      var height = Math.max(graph.offsetHeight || Math.round(rect.height) || (isGlobal ? Math.round(window.innerHeight * 0.82) : 250), 250);
      var minDim = Math.min(width, height);

      var links = [];
      var allTags = [];
      var validLinks = new Set(data.keys());

      data.forEach(function (details, source) {
        var outgoing = details.links || [];
        for (var i = 0; i < outgoing.length; i++) {
          var destRaw = outgoing[i];
          try {
            destRaw = decodeURIComponent(destRaw);
          } catch (e) {}
          var dest = simplifySlug(destRaw);
          if (validLinks.has(dest)) {
            links.push({ source: source, target: dest });
          }
        }

        if (showTags) {
          var tags = details.tags || [];
          for (var i = 0; i < tags.length; i++) {
            var tag = tags[i];
            if (removeTags.indexOf(tag) === -1) {
              var tagSlug = simplifySlug("tags/" + tag);
              if (allTags.indexOf(tagSlug) === -1) {
                allTags.push(tagSlug);
              }
              links.push({ source: source, target: tagSlug });
            }
          }
        }
      });

      var neighbourhood = new Set();
      if (depth >= 0) {
        var queue = [slug];
        var seen = new Set([slug]);
        for (var d = 0; d <= depth && queue.length > 0; d++) {
          var nextQueue = [];
          for (var qi = 0; qi < queue.length; qi++) {
            var cur = queue[qi];
            neighbourhood.add(cur);
            for (var li = 0; li < links.length; li++) {
              var link = links[li];
              if (link.source === cur && !seen.has(link.target)) {
                seen.add(link.target);
                nextQueue.push(link.target);
              }
              if (link.target === cur && !seen.has(link.source)) {
                seen.add(link.source);
                nextQueue.push(link.source);
              }
            }
          }
          queue = nextQueue;
        }
      } else {
        validLinks.forEach(function (id) {
          neighbourhood.add(id);
        });
        for (var i = 0; i < allTags.length; i++) {
          neighbourhood.add(allTags[i]);
        }
      }

      var nodes = [];
      var nodeMap = new Map();
      neighbourhood.forEach(function (url) {
        var isTag = url.startsWith("tags/");
        var text = isTag ? "#" + url.substring(5) : data.get(url)?.title || url;
        var nodeTags = isTag ? [] : data.get(url)?.tags || [];
        var node = {
          id: url,
          text: text,
          tags: nodeTags,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        };
        nodes.push(node);
        nodeMap.set(url, node);
      });

      var graphLinks = [];
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (neighbourhood.has(link.source) && neighbourhood.has(link.target)) {
          var sourceNode = nodeMap.get(link.source);
          var targetNode = nodeMap.get(link.target);
          if (sourceNode && targetNode) {
            graphLinks.push({ source: sourceNode, target: targetNode });
          }
        }
      }

      // Dynamic sizing based on viewport dimension and graph density
      var nodeCount = nodes.length;
      var countFactor = Math.max(0.75, Math.min(1.3, 16 / Math.max(nodeCount, 6)));
      var baseRadius = isGlobal
        ? Math.max(6.5, Math.min(13, minDim * 0.0125)) * countFactor
        : Math.max(2.8, Math.min(4.5, minDim * 0.014));
      var linkCounts = new Map();
      for (var i = 0; i < graphLinks.length; i++) {
        linkCounts.set(graphLinks[i].source.id, (linkCounts.get(graphLinks[i].source.id) || 0) + 1);
        linkCounts.set(graphLinks[i].target.id, (linkCounts.get(graphLinks[i].target.id) || 0) + 1);
      }

      function nodeRadius(d) {
        if (d.id === slug) return baseRadius * 1.55;
        var numLinks = linkCounts.get(d.id) || 0;
        return baseRadius + Math.min(baseRadius * 0.55, Math.sqrt(numLinks) * (baseRadius * 0.22));
      }

      var styles = getComputedStyle(document.documentElement);

      if (!isGlobal) {
        return renderCategorizedLocalGraph(graph, slug, nodes, width, height, styles);
      }

      return renderCategorizedModalGraph(graph, slug, nodes, graphLinks, width, height, styles, {
        enableDrag: enableDrag,
        enableZoom: enableZoom,
        focusOnHover: focusOnHover,
        visited: visited,
        radiusOf: nodeRadius,
        closeModal: hideGlobalGraph,
      });
    }

    var localCleanups = [];
    var globalCleanups = [];
    var currentRenderGeneration = 0;

    function cleanupLocal() {
      for (var i = 0; i < localCleanups.length; i++) {
        localCleanups[i]();
      }
      localCleanups = [];
    }

    function cleanupGlobal() {
      for (var i = 0; i < globalCleanups.length; i++) {
        globalCleanups[i]();
      }
      globalCleanups = [];
    }

    var globalContainers = [];
    var globalIcons = [];
    var documentClickHandler = null;
    var documentKeydownHandler = null;
    var iconClickHandler = null;

    function hideGlobalGraph() {
      cleanupGlobal();
      for (var i = 0; i < globalContainers.length; i++) {
        globalContainers[i].classList.remove("active");
        var sidebar = globalContainers[i].closest(".sidebar");
        if (sidebar) {
          sidebar.style.zIndex = "";
        }
      }
    }

    function anyGlobalGraphActive() {
      for (var i = 0; i < globalContainers.length; i++) {
        if (globalContainers[i].classList.contains("active")) {
          return true;
        }
      }
      return false;
    }

    function showGlobalGraph() {
      cleanupGlobal();
      var currentSlug = getSlugFromUrl();
      for (var i = 0; i < globalContainers.length; i++) {
        var container = globalContainers[i];
        container.classList.add("active");
        var sidebar = container.closest(".sidebar");
        if (sidebar) {
          sidebar.style.zIndex = "1";
        }

        var graphContainer = container.querySelector(".global-graph-container");
        if (graphContainer) {
          (function (gc) {
            renderGraph(gc, currentSlug, undefined)
              .then(function (cleanup) {
                globalCleanups.push(cleanup);
              })
              .catch(function (err) {
                console.error("[Graph] Global render error:", err);
              });
          })(graphContainer);
        }
      }
    }

    function toggleGlobalGraph() {
      if (anyGlobalGraphActive()) {
        hideGlobalGraph();
      } else {
        showGlobalGraph();
      }
    }

    function renderLocal(currentSlug) {
      cleanupLocal();
      var thisGeneration = ++currentRenderGeneration;
      var rawSlug = currentSlug || getSlugFromUrl();
      var slug = rawSlug;
      try {
        slug = decodeURIComponent(rawSlug);
      } catch (e) {}
      addToVisited(simplifySlug(slug));

      var localContainers = document.querySelectorAll(".graph-container");
      for (var i = 0; i < localContainers.length; i++) {
        (function (container) {
          renderGraph(container, slug, thisGeneration)
            .then(function (cleanup) {
              if (thisGeneration === currentRenderGeneration) {
                localCleanups.push(cleanup);
              }
            })
            .catch(function (err) {
              console.error("[Graph] Local render error:", err);
            });
        })(localContainers[i]);
      }
    }

    function handleNav(e) {
      var rawSlug = e && e.detail ? e.detail.url : getSlugFromUrl();
      var slug = rawSlug;
      try {
        slug = decodeURIComponent(rawSlug);
      } catch (e) {}
      addToVisited(simplifySlug(slug));

      renderLocal(slug);

      globalContainers = Array.from(document.querySelectorAll(".global-graph-outer"));
      globalIcons = Array.from(document.querySelectorAll(".global-graph-icon"));

      if (globalContainers.length === 0 && globalIcons.length === 0) {
        if (iconClickHandler) {
          for (var i = 0; i < globalIcons.length; i++) {
            globalIcons[i].removeEventListener("click", iconClickHandler);
          }
          iconClickHandler = null;
        }
        if (documentClickHandler) {
          document.removeEventListener("click", documentClickHandler);
          documentClickHandler = null;
        }
        if (documentKeydownHandler) {
          document.removeEventListener("keydown", documentKeydownHandler);
          documentKeydownHandler = null;
        }
        return;
      }

      if (iconClickHandler) {
        for (var i = 0; i < globalIcons.length; i++) {
          globalIcons[i].removeEventListener("click", iconClickHandler);
        }
      }

      iconClickHandler = function () {
        toggleGlobalGraph();
      };
      for (var i = 0; i < globalIcons.length; i++) {
        globalIcons[i].addEventListener("click", iconClickHandler);
      }

      if (documentClickHandler) {
        document.removeEventListener("click", documentClickHandler);
      }
      documentClickHandler = function (e) {
        if (anyGlobalGraphActive()) {
          var closeBtn = e.target.closest(".global-graph-close-btn");
          if (closeBtn) {
            hideGlobalGraph();
            return;
          }
          var inContainer = e.target.closest(".global-graph-container");
          var inIcon = e.target.closest(".global-graph-icon");
          if (!inContainer && !inIcon) {
            hideGlobalGraph();
          }
        }
      };
      document.addEventListener("click", documentClickHandler);

      if (documentKeydownHandler) {
        document.removeEventListener("keydown", documentKeydownHandler);
      }
      documentKeydownHandler = function (e) {
        if (e.key === "Escape") {
          if (anyGlobalGraphActive()) {
            hideGlobalGraph();
          }
          return;
        }

        if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
          e.preventDefault();
          toggleGlobalGraph();
        }
      };
      document.addEventListener("keydown", documentKeydownHandler);

      if (anyGlobalGraphActive()) {
        showGlobalGraph();
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        handleNav({ detail: { url: getSlugFromUrl() } });
      });
    } else {
      handleNav({ detail: { url: getSlugFromUrl() } });
    }
    document.addEventListener("prenav", function () {
      cleanupLocal();
      if (globalContainers.length > 0) {
        cleanupGlobal();
      }
    });
    document.addEventListener("nav", handleNav);
    document.addEventListener("render", handleNav);

    function handleThemeChange() {
      renderLocal();
      if (globalContainers.length > 0 && anyGlobalGraphActive()) {
        showGlobalGraph();
      }
    }
    document.addEventListener("themechange", handleThemeChange);

    var resizeTimer = null;
    function handleResize() {
      if (globalContainers.length > 0 && anyGlobalGraphActive()) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          if (anyGlobalGraphActive()) {
            showGlobalGraph();
          }
        }, 150);
      }
    }
    window.addEventListener("resize", handleResize);
  }
})();
