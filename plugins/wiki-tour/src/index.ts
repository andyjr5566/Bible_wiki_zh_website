export { default as TourLauncher } from "./components/TourLauncher";

export const manifest = {
	name: "wiki-tour",
	displayName: "Wiki Tour",
	category: "component",
	version: "1.0.0",
	quartzVersion: ">=5.0.0",
	components: {
		TourLauncher: {
			displayName: "Wiki Tour",
			defaultPosition: "beforeBody",
			defaultPriority: 5,
		},
	},
};
