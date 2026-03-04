import * as fs from "fs-extra";
import * as path from "path";

export async function ensureAndWrite(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content);
}

export async function ensureAndWriteJson(filePath: string, data: object): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}

export async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function appendToFile(filePath: string, content: string): Promise<void> {
  const existing = await readFileIfExists(filePath);
  if (existing) {
    await fs.writeFile(filePath, existing + "\n" + content);
  } else {
    await ensureAndWrite(filePath, content);
  }
}

export async function getDirectoryStructure(dirPath: string, prefix = ""): Promise<string> {
  if (!await fs.pathExists(dirPath)) return "";

  const items = await fs.readdir(dirPath);
  let structure = "";

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = await fs.stat(itemPath);
    const icon = stat.isDirectory() ? "📁" : "📄";

    structure += `${prefix}${icon} ${item}\n`;

    if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
      structure += await getDirectoryStructure(itemPath, prefix + "  ");
    }
  }

  return structure;
}
