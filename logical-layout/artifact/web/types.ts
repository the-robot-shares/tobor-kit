/** Shared shapes for the artifact family. Property-only — never HTML attributes. */

export type ArtifactVersion = string | number;

export interface Artifact {
  id: string;
  title: string;
  version: ArtifactVersion;
  body: string;
  /** Label only. Body is always text/`<pre>` — never HTML. */
  mime?: string;
}

export interface ReviewStartDetail {
  artifactId: string;
  version: ArtifactVersion;
}

export interface ArtifactSaveDetail {
  id: string;
  title: string;
  body: string;
  version?: ArtifactVersion;
}

export const SAMPLE_ARTIFACT: Artifact = {
  id: 'demo',
  title: 'Release notes',
  version: 1,
  body: 'Ship the island.\nDo not render HTML.',
  mime: 'text/plain',
};
