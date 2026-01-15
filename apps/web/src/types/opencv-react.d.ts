declare module "opencv-react" {
  import { ReactNode } from "react";

  export interface OpenCvProviderProps {
    children: ReactNode;
    openCvPath?: string;
    onLoad?: (cv: unknown) => void;
  }

  export function OpenCvProvider(props: OpenCvProviderProps): JSX.Element;

  export function useOpenCv(): {
    loaded: boolean;
    cv: unknown;
  };
}
