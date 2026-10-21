export { Appearance } from "./components/index"

export const manifest = {
	name: "site-ux",
	displayName: "外觀設定",
	category: "component",
	version: "1.0.0",
	quartzVersion: ">=5.0.0",
	components: {
		Appearance: {
			displayName: "Appearance",
			defaultPosition: "left",
			defaultPriority: 32,
		},
	},
};
