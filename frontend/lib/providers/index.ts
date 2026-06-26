export { unsiloedAdapter }         from "./unsiloed-adapter";
export { awsTextractAdapter }      from "./aws-textract";
export { googleDocAIAdapter }      from "./google-docai";
export { azureFormRecognizerAdapter } from "./azure-form-recognizer";
export type { IProviderAdapter, ProviderCredentials, ExtractionJob } from "./types";

import { unsiloedAdapter }            from "./unsiloed-adapter";
import { awsTextractAdapter }         from "./aws-textract";
import { googleDocAIAdapter }         from "./google-docai";
import { azureFormRecognizerAdapter } from "./azure-form-recognizer";
import type { IProviderAdapter }      from "./types";

export const ALL_PROVIDERS: IProviderAdapter[] = [
  unsiloedAdapter,
  awsTextractAdapter,
  googleDocAIAdapter,
  azureFormRecognizerAdapter,
];

export function getProvider(id: string): IProviderAdapter | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}
