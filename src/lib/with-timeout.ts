// Délai maximum côté navigateur pour un appel serveur : si la fonction est
// coupée par l'hébergeur ou que la réponse ne revient jamais, l'interface
// affiche une erreur au lieu de tourner indéfiniment.
export class TimeoutError extends Error {}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}
