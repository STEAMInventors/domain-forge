import { z } from 'zod';

/** Domain-neutral example stage output schema */
export const ExampleStageOutputSchema = z.object({
  schemaVersion: z.literal('0.1.0'),
  observation: z.string().min(1),
  metricValue: z.number(),
  tags: z.array(z.string()).default([]),
});

export type ExampleStageOutput = z.infer<typeof ExampleStageOutputSchema>;
