/** Error con mensaje listo para mostrar al usuario (en español). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof UserError) return e.message;
  if (e instanceof Error && /network|fetch/i.test(e.message)) return 'Sin conexión. Inténtalo de nuevo cuando tengas internet.';
  return 'Algo ha fallado. Inténtalo de nuevo.';
}
