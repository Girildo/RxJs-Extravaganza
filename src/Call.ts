import { bindCallback, defer, EMPTY, identity, interval, Observable, of, scheduled, Subject, throwError, timer } from "rxjs"
import { catchError, delay, delayWhen, filter, flatMap, map, mergeMap, mergeMapTo, retryWhen, sample, switchAll, switchMap, switchMapTo, tap, withLatestFrom } from "rxjs/operators";



function Mock<T>(token: string): Observable<T> {
    return timer(1000)
        .pipe(
            map(_ => {
                if (token === '42')
                    return <T><unknown>"Everything OK";
                else {
                    throw (401);
                    // const chance = Math.random();
                    // if (chance < 0.1 || token === '42')
                    //     return <T><unknown>"Everything OK";
                    // else if (chance < 0.95)
                    //     throw (401);
                    // else
                    //     throw (500);
                }
            })
        );
}


const store$ = new Subject<{ [key: string]: string }>();

function dispatchRefresh(): void {
    store$.next({ 'unrelated': 'Something we dont care about' });
    console.log(new Date() + " Action is being dispatched!")
    setTimeout(() => {
        store$.next({ 'token': '42' });
        console.log(new Date() + " Token refreshed!")
    }, Math.random() * 8000);
    // store$.next({ 'token': '42' });
}

export function Call<T>(opts: { token: string }): Observable<T> {

    console.log("Calling Call with opts", opts);

    return Mock<T>(opts.token)
        .pipe(
            // emits input observable unless there is error
            catchError((error, caught) => {
                if (error === 500)
                    return throwError('Fatal error');
                else {
                    console.log('Caught transient error ' + error);
                    const refreshToken$ = defer(() => {
                        dispatchRefresh();
                        return store$.pipe(filter(v => v.token !== undefined), map(v => v.token));
                    }
                    )

                    const obs = refreshToken$
                        .pipe(refr =>
                            refr.pipe(
                                map(k => Call<T>({ token: k }),
                                ),
                                switchAll()
                            ));
                    return obs;
                }
            }),
        );
} 

