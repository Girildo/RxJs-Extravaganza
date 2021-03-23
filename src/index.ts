import { Call } from "./Call";
console.log('Running');
Call<string>({'token':'123'}).subscribe(console.log, console.error)