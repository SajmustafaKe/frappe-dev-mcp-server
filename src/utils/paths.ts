import * as path from "path";

export function toSnakeCase(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}

export function toPascalCase(name: string): string {
  return name.replace(/\s+/g, "");
}

export function getAppPath(frappePath: string, appName: string): string {
  return path.join(frappePath, "apps", appName);
}

export function getAppModulePath(frappePath: string, appName: string): string {
  return path.join(frappePath, "apps", appName, appName);
}

export function getModulePath(
  frappePath: string,
  appName: string,
  moduleName: string
): string {
  return path.join(getAppModulePath(frappePath, appName), toSnakeCase(moduleName));
}

export function getDoctypePath(
  frappePath: string,
  appName: string,
  moduleName: string,
  doctypeName: string
): string {
  return path.join(
    getModulePath(frappePath, appName, moduleName),
    "doctype",
    toSnakeCase(doctypeName)
  );
}

export function getHooksPath(frappePath: string, appName: string): string {
  return path.join(getAppModulePath(frappePath, appName), "hooks.py");
}

export function getApiPath(frappePath: string, appName: string): string {
  return path.join(getAppModulePath(frappePath, appName), "api");
}

export function getTemplatesPath(frappePath: string, appName: string): string {
  return path.join(getAppModulePath(frappePath, appName), "templates");
}

export function getWwwPath(frappePath: string, appName: string): string {
  return path.join(getAppModulePath(frappePath, appName), "www");
}

export function getPatchesPath(frappePath: string, appName: string): string {
  return path.join(getAppModulePath(frappePath, appName), "patches");
}

export function getFixturesPath(frappePath: string, appName: string): string {
  return path.join(getAppModulePath(frappePath, appName), "fixtures");
}

export function getTestsPath(
  frappePath: string,
  appName: string,
  moduleName: string,
  doctypeName: string
): string {
  return path.join(
    getDoctypePath(frappePath, appName, moduleName, doctypeName),
    `test_${toSnakeCase(doctypeName)}.py`
  );
}
