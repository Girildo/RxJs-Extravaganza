"use strict";
exports.__esModule = true;
exports.Call = void 0;
var rxjs_1 = require("rxjs");
var operators_1 = require("rxjs/operators");
function Mock(token) {
    return rxjs_1.timer(1000)
        .pipe(operators_1.map(function (_) {
        if (token === '42')
            return "Everything OK";
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
    }));
}
var store$ = new rxjs_1.Subject();
function dispatchRefresh() {
    store$.next({ 'unrelated': 'Something we dont care about' });
    console.log(new Date() + " Action is being dispatched!");
    setTimeout(function () {
        store$.next({ 'token': '42' });
        console.log(new Date() + " Token refreshed!");
    }, Math.random() * 8000);
    // store$.next({ 'token': '42' });
}
function Call(opts) {
    console.log("Calling Call with opts", opts);
    return Mock(opts.token)
        .pipe(
    // emits input observable unless there is error
    operators_1.catchError(function (error, caught) {
        if (error === 500)
            return rxjs_1.throwError('Fatal error');
        else {
            console.log('Caught transient error ' + error);
            var refreshToken$ = rxjs_1.defer(function () {
                dispatchRefresh();
                return store$.pipe(operators_1.filter(function (v) { return v.token !== undefined; }), operators_1.map(function (v) { return v.token; }));
            });
            var obs = refreshToken$
                .pipe(function (refr) {
                return refr.pipe(operators_1.map(function (k) { return Call({ token: k }); }), operators_1.switchAll());
            });
            return obs;
        }
    }));
}
exports.Call = Call;
//# sourceMappingURL=Call.js.map