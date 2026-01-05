declare module "@/generated/build-info.json" {
  interface BuildInfo {
    version: string;
    buildTime: string;
    buildTimestamp: number;
    git: {
      commit: string | null;
      commitShort: string | null;
      branch: string | null;
      tag: string | null;
      isDirty: boolean;
    };
    environment: string;
    buildNumber: string | null;
    nodeVersion: string;
  }

  const buildInfo: BuildInfo;
  export default buildInfo;
}
