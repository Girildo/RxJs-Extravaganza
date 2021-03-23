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
 * In this experiment, this action always succeeds after a delay picked at random between 0 and 8 seconds.
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

  // Start by calling the service. If everything is right, we're happy and done.
  return Mock<T>(opts.token)
    .pipe(
      // catch the error
      catchError((error, caughtIgnored) => {
        // If we cannot recover, we just forward the error to the caller.
        if (error === 500) { return throwError('Fatal error'); }

        /*
         * Otherwise, we need to
         * 1) refresh the token
         * 2) call the Call<T> (newToken) again
         *
         * We have a problem: dispatchAction() returns void, we only get to know when and whether
         * the token has been refreshed after the store tells us so.
         * However, we cannot call dispatchAction() directly, because we need to capture the side
         * effects it produces.
         */

        console.log(`Caught transient error ${error}`);

        /*
         * Solution => use defer() (https://rxjs-dev.firebaseapp.com/api/index/function/defer)
         * Essentialy, defer() calls an observable factory (i.e. a function that returns
         * an observable) when it gets subscribed to.
         * Here, we create an observable that, when subscribed to, dispatches the refresh action
         * and emits the refreshed token when the store notifies a change.
         */

        /**
         * An Observable that dispatches that forces the dispatch of the token and emits the
         * refreshed token as soon as it's ready.
         */
        const refreshToken$ = defer(() => {
          dispatchRefresh();
          return store$.pipe(filter((v) => v.token !== undefined), map((v) => v.token));
        });

        /*
         * We now have a way to refresh the token and be notified of this action happening.
         * What is left to be done is to take the refreshed token (emitted by refreshToken$), pass
         * it into Call<T>, and then SWITCH the outer subscription to the inner, newly created Call<T> observable.
         */

        /**
         * Our final observable listens to the refresh of the token, maps the token into Call and then forgets
         * the subscription to refreshToken, only keeping the subscription to the inner, newly created, Call<T>.
         */
        const obs = refreshToken$
          .pipe((refr) => refr.pipe(
            map((k) => Call<T>({ token: k })),
            switchAll(), //Without this, we'd have an Observable<Observable<T>>, we need Observable<T>!
          ));
        return obs;
      }),
    );
}
