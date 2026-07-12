import "react-i18next";
import type en from "./en.json";

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    resources: {
      translation: typeof en;
    };
  }
}
