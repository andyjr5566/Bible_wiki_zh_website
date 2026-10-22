export { BookPicker, BookGrid, ChapterGrid } from "./components/index"
export type { BookGridProps, ChapterGridProps } from "./components/index"

export const manifest = {
	name: "book-picker",
	displayName: "書卷章節選擇器",
	category: "component",
	version: "1.0.0",
	quartzVersion: ">=5.0.0",
	components: {
		BookPicker: {
			displayName: "BookPicker",
			defaultPosition: "left",
			defaultPriority: 40,
		},
	},
};
