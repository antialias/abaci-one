// Type declaration for CSS imports
// This allows TypeScript to understand CSS imports in @soroban/abacus-react's declaration files
declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}
