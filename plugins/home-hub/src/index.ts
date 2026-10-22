export { HomeHub } from "./components/index"

export const manifest = {
	name: "home-hub",
	displayName: "首頁入口",
	category: "component",
	version: "1.0.0",
	quartzVersion: ">=5.0.0",
	components: {
		HomeHub: {
			displayName: "HomeHub",
			defaultPosition: "beforeBody",
			defaultPriority: 4,
		},
	},
};
