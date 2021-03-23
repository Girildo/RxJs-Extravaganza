import {
  defer, Observable, Subject, throwError, timer,
} from 'rxjs';
import {
  catchError, filter, map, switchAll,
} from 'rxjs/operators';

// Mock store
const store$ = new Subject<{ [key: string]: string }>();
/**
 * Mocks the HttpRequest
 * @param token Mock parameter, the request succeeds if and only if token equals the string 42
 * @returns The mocked Observable<T>
 */
function Mock<T>(token: string): Observable<T> {
  return timer(1000)
    .pipe(
      map((_) => {
        if (token === '42') { return <T><unknown>'Everything OK'; }

        throw (new Error('401'));
      }),
    );
}

/**
 * Simulates the dispatch of the refresh action.
 * In this experiment, this action always succeeds after a random delay between 0 and 8 seconds.
 */
function dispatchRefresh(): void {
  store$.next({ unrelated: 'Something we dont care about' });
  console.log(`${new Date()} Action is being dispatched!`);
  setTimeout(() => {
    store$.next({ token: '42' });
  }, Math.random() * 8000);
}

export default function Call<T>(opts: { token: string }): Observable<T> {
  console.log('Calling Call with opts', opts);

  // Start by calling the service. If everything is right, we're happy and done
  return Mock<T>(opts.token)
    .pipe(
      // catch the error
      catchError((error, caught) => {
        // If we cannot recover, we just forward the error to the caller
        if (error === 500) { return throwError('Fatal error'); }

        console.log(`Caught transient error ${error}`);
        const refreshToken$ = defer(() => {
          dispatchRefresh();
          return store$.pipe(filter((v) => v.token !== undefined), map((v) => v.token));
        });

        const obs = refreshToken$
          .pipe((refr) => refr.pipe(
            map((k) => Call<T>({ token: k })),
            switchAll(),
          ));
        return obs;
      }),
    );
}
