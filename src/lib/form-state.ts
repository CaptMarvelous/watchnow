/** Shape returned by server actions used with useActionState. */
export type FormState =
  | {
      ok?: boolean;
      message?: string;
      error?: string;
      fieldErrors?: Record<string, string>;
      /** Non-secret values echoed back so the form can repopulate after an error. */
      values?: Record<string, string>;
    }
  | undefined;
