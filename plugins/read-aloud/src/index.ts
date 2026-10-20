export { default as ReadAloud } from "./components/ReadAloud";

export const manifest = {
	name: "read-aloud",
	displayName: "經文朗讀",
	category: "component",
	version: "1.0.0",
	quartzVersion: ">=5.0.0",
	components: {
		ReadAloud: {
			displayName: "ReadAloud",
			defaultPosition: "beforeBody",
			defaultPriority: 6,
		},
	},
};
