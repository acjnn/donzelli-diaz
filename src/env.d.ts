declare module "*.csv?raw" {
	const content: string;
	export default content;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
