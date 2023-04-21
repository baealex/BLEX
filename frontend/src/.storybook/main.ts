import type { StorybookConfig } from "@storybook/nextjs";
const config: StorybookConfig = {
  stories: [
    "../components/**/*.mdx",
    "../components/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-mdx-gfm"
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {}
  },
  docs: {
    autodocs: "tag"
  }
};
export default config;
