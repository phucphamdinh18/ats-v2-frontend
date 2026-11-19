export function preparePages(args: {
  mode: "single" | "calendar-preview";
  root: string;
  revision: string;
  destination: string;
  productionRoot?: string;
  previewRoot?: string;
  previewRevision?: string;
}): Promise<void>;
