export { VerseReturn } from "./components/index"

export const manifest = {
	name: "verse-return",
	displayName: "回到剛才的經節",
	category: "component",
	version: "1.0.0",
	quartzVersion: ">=5.0.0",
	components: {
		VerseReturn: {
			displayName: "VerseReturn",
			defaultPosition: "afterBody",
			defaultPriority: 90,
		},
	},
};
