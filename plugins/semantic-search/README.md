# @quartz-community/search

The search component for the Bible study site.

## Features

- **Verse Search** - Search published Bible text one verse at a time and follow a link to the chapter.
- **Refinement and Shortlist** - Add terms that must occur in the same verse or save verses from separate queries in the current tab.
- **Knowledge Search** - Search entries and appendices by text, with multiple selectable categories.
- 📱 **Mobile Responsive** - Works great on all devices
- 🎯 **Search Preview** - Optional content preview panel
- 🌐 **Multi-Language** - Supports 30+ locales
- ⌨️ **Keyboard Shortcuts** - `Ctrl/Cmd + K` to open, `Escape` to close

## Installation

```bash
npx quartz plugin add github:quartz-community/search
```

## Usage

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/search
    enabled: true
    layout:
      position: left
      priority: 20
      group: toolbar
      groupOptions:
        grow: true
```

For advanced use cases, you can override in TypeScript:

```ts title="quartz.ts (override)"
import * as ExternalPlugin from "./.quartz/plugins";

ExternalPlugin.Search({
  enablePreview: true,
  placeholder: "Search for something",
  title: "Search",
});
```

## Configuration Options

```typescript
interface SearchOptions {
  /** Enable content preview panel */
  enablePreview?: boolean;
  /** Custom placeholder text */
  placeholder?: string;
  /** Custom title for the search button */
  title?: string;
}
```

## Default Behavior

By default, the search component:

- Displays as a button with a search icon
- Opens a fullscreen search modal when clicked
- Shows the total and renders results one page at a time
- Enables content preview on desktop (can be disabled)
- Supports keyboard navigation (arrow keys, Enter, Escape)
- Loads the index for the active mode as needed

## How It Works

The Search component:

1. Looks up direct Scripture references with the site's slim page index.
2. Matches text and refinement conditions in `static/verseIndex.json`, generated from published chapter pages.
3. Loads the full content index for knowledge search and filters matches by the selected categories.
4. Fetches page HTML separately for knowledge result previews.

> [!info]
> Knowledge search requires the ContentIndex emitter. Verse search uses the site's VerseIndex emitter.

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Open/Close search
- `Escape` - Close search
- `Arrow Up/Down` - Navigate results
- `Enter` - Open selected result

## Development

This is a first-party Quartz community plugin. It serves as both:

1. A production-ready Search component
2. A reference implementation for building Quartz community plugins

To build locally:

```bash
npm install
npm run build
```

The `prepare` script automatically builds during installation.

## Documentation

See the [Quartz documentation](https://quartz.jzhao.xyz/features/full-text%20search) for more information.

## License

MIT
