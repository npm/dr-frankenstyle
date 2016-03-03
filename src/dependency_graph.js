import fs from 'fs-promise';
import path from 'path';
import promisify from 'es6-promisify';
import DAG from 'dag-map';
import readTree from 'read-package-tree';

const readTreeP = promisify(readTree);

export default class DependencyGraph {
  constructor(whitelist, rootPackageDir = process.cwd()) {
    this.whitelist = whitelist;
    this.rootPackageDir = rootPackageDir;
  }

  readJson(...paths) {
    return new Promise(async (resolve) => {
      try {
        const packageJsonPath = path.resolve(this.rootPackageDir, ...paths);
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        packageJson.path = path.dirname(packageJsonPath);
        resolve(packageJson);
      } catch(e) {
        resolve(null);
      }
    });
  }

  installedPackagesLookup() {
    const unnest = (list, pkg) => list.concat(pkg.children.reduce(unnest, [pkg]));
    return readTreeP(this.rootPackageDir).then(root => {
      return root.children.reduce(unnest, []).reduce((lookupTable, pkg) => {
        pkg.package.path = pkg.path;
        lookupTable[pkg.package.name] = pkg.package;
        return lookupTable;
      }, {});
    });
  }

  async dependencies() {
    const rootPackageJson = await this.readJson('package.json');
    const installedPackagesLookup = await this.installedPackagesLookup();

    if (this.whitelist !== null) {
      for (let pkg in rootPackageJson.dependencies) {
        if (this.whitelist.indexOf(pkg) === -1) {
          delete rootPackageJson.dependencies[pkg];
        }
      }
    }

    const result = new Set();
    const packagesToCheck = [rootPackageJson];
    while (packagesToCheck.length) {
      const pkg = packagesToCheck.shift();
      if (!pkg) continue;
      for (const dependencyName of Object.keys(Object(pkg.dependencies))) {
        const dependency = installedPackagesLookup[dependencyName];
        if(!dependency) console.error(`ERROR: missing dependency "${dependencyName}"`);
        if (result.has(dependency)) { continue; }
        result.add(dependency);
        packagesToCheck.push(dependency);
      }
    }
    return Array.from(result);
  }

  async styleDependencies() {
    return (await this.dependencies())
      .filter(Boolean)
      .filter(packageJson => 'style' in packageJson);
  }

  async styleDependencyLookup() {
    const styleDependencies = (await this.styleDependencies()).filter(Boolean);
    const styleDependencyNames = styleDependencies.map(pkg => pkg.name);

    return styleDependencies.reduce((lookupTable, pkg) => {
      lookupTable[pkg.name] = Object.keys(Object(pkg.dependencies))
        .filter(dependencyName => styleDependencyNames.indexOf(dependencyName) >= 0);
      return lookupTable;
    }, {});
  }

  async orderedStyleDependencies() {
    const dag = new DAG();
    const installedPackagesLookup = await this.installedPackagesLookup();
    const styleDependencyLookup = await this.styleDependencyLookup();
    const packageNames = Object.keys(styleDependencyLookup);

    for (const packageName of packageNames) {
      dag.add(packageName);
      for (const dependency of styleDependencyLookup[packageName]) {
        dag.addEdge(dependency, packageName);
      }
    }

    const result = [];
    dag.topsort(vertex => result.push(vertex.name));
    return result.map(packageName => installedPackagesLookup[packageName]);
  }
}
