# RxQuery
It is built with rxjs and designed easy to use. queryStore is Singleton, only one exists throughout the app.

# Work in progress

This is a work in progress, please do not install it in your project yet!!!!

# RxNgQuery

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.2.2.

## Test

[Sample Test Url: https://stackblitz.com/edit/angular-ivy-vxsmmj?file=src/app/app.component.ts](https://stackblitz.com/edit/angular-ivy-vxsmmj?file=src/app/app.component.ts)

## RxQueryOption
### StoreOptions (For RxStore & RxQuery)
<table width="100%">
<thead>
<tr>
<th width="100px">name</th>
<th width="200px">type</th>
<th>description</th>
</tr>
</thead>
<tbody>
<tr>
<th>key</th>
<td>string</td>
<td><b>required</b><br />should be unique for query and store</td>
</tr>

<tr>
<th>initState</th>
<td>any</td>
<td><b>required</b><br />initial state for view data</td>
</tr>

<tr>
<th>query</th>
<td>function (args: any): Observable&lt;any&gt; </td>
<td><b>defaultValue: (s) => of(s)</b><br />async operations, for static store you can use it for transformer</td>
</tr>

<tr>
<th>isEqual</th>
<td>function (a:any, b:any):boolean</td>
<td><b>defaultValue: shallowEqual(with 2 deps)</b><br />fn for distinctUntilChange for cache</td>
</tr>

<tr>
<th>retry</th>
<td>number</td>
<td><b>defaultValue: 2 </b><br />with an error, how many times more tries the query.</td>
</tr>

<tr>
<th>retryDelay</th>
<td>number</td>
<td><b>defaultValue: 3 (3seconds) </b><br />delay between retries</td>
</tr>

<tr>
<th>staticStore</th>
<td>boolean</td>
<td><b>defaultValue: false</b><br />ignore all refetch strategy</td>
</tr>
</tbody>
</table>

### Refetch & Cache Strategy (For RxQuery only)
<table width="100%">
<thead>
<tr>
<th width="100px">name</th>
<th width="200px">type</th>
<th>description</th>
</tr>
</thead>
<tbody>

<tr>
<th>prefetch</th>
<td>{param: any}</td>
<td><b>defaultValue: null </b><br />perform fetch with registration, the data prop goes to fetch argument</td>
</tr>

<tr>
<th>refetchOnReconnect</th>
<td>boolean</td>
<td><b>defaultValue: false </b><br />perform fetch with registration, the data prop goes to fetch argument.</td>
</tr>

<tr>
<th>refetchOnEmerge</th>
<td>boolean</td>
<td><b>defaultValue: false </b><br />refetch on window.visibilityChange => document.visibilityState === 'visible'.</td>
</tr>

<tr>
<th>refetchInterval</th>
<td>number</td>
<td><b>defaultValue: 24 * 3600 (1 day) </b><br />min value is 2(2seconds)<br />interval calls. restart if query called and successed. unit is second</td>
</tr>

<tr>
<th>staleModeDuration</th>
<td>number</td>
<td><b>defaultValue: 300 (5 minutes) </b><br />duration to perform event of merging refetchOnReconnect & refetchOnEmerge and only if staleModeDuration has passed from last fetch, refetch works. unit is second(5 === 5second)</td>
</tr>

<tr>
<th>refetchOnStaleMode</th>
<td>boolean</td>
<td><b>defaultValue: false </b><br />by default, refetch action by refetchInterval does not work when it is on the stale mode, with true, it ignores default and perform refetch</td>
</tr>

<tr>
<th>keepAlive</th>
<td>boolean</td>
<td><b>defaultValue: false</b><br />After destroying store, keep the cache</td>
</tr>

<tr>
<th>caching</th>
<td>number</td>
<td><b>defaultValue: 0(cache only one for initial hash)</b><br />min: 0, max: 50<br />number of caching for previous response. max is 30</td>
</tr>
<tr>

<tr>
<th>paramToHash</th>
<td>function: (p: param) => string</td>
<td><b>defaultValue: undefined</b><br />util to get cash hash key from query param, by the hashkey count of cache object varies</td>
</tr>

<tr>
<td colspan="3">
  you can add rxQueryCachingKey key to param for query and it has more priority to get hash.
</td>
</tr>
</tbody>
</table>


# staticStore
inside store has 2 classes
one for RxQuery, one for RxStore
RxQuery is to use refetch & cache strategy
RxStore is to use storage for cache and you can still transform by query option


## Module Import

```typescript

import { RxNgQueryModule } from 'rx-ng-query';

interface RootStoreState {...}

const storeInitiator: (...arg: any[]) => RxQueryOption[] = (apiService: ApiService ) => [
  { key: 'limit', initState: { daily: 0, monthly: 0 }, query: apiService.fetchLimit.bind(apiService) },
  { key: 'goods', initState: [], query: apiService.fetchGoods.bind(apiService) },
];

const storeFetchDependency = [ApiService]; // this will be injected as storeInit arguments

imports: [
    ApiService, // custom service
    RxNgQueryModule.withInitStore<RootStoreState>(
      storeInitiator,
      storeFetchDependency
    ),
]

// or if you don't have initial store just import RxNgQueryModule

imports: [
  RxNgQueryModule
]

```

## Dynamic Store Initiation

```typescript

// in component
constructor(private rxNgQueryStore: RxNgQueryStore < any >,
  private apiService: ApiService,
)
{
  // rxQueryStore.registerStore(options);
  rxNgQueryStore.registerStore({
    key: 'limit',
    initState: [],
    prefetch: {param: 'daily'},
    query: apiService.fetchLimit.bind(apiService)
  });
}


// as service
@Injectable()
@RxQueryService()
export class HistoryApiService {
  constructor(private apiService: ApiService) {
  }

  // prefetch for fetching with registration
  @RxQuery({key: 'history', initState: [], prefetch: {param: null}})
  fetchHistory() {
    // this function goes to query and calling it calling fetch.
    return this.apiService.fetchHistory();
  }
}

// Don't forget to receive injection of service at the component,
// otherwise they does not work.

@Component({
  ...,
  providers: [HistoryApiService],
})
export class SomeComponent {
    constructor(private historyApiService: HistoryApiService) {
        // you should inject inside the component
        // otherwise it will not initiated.
    }
}

```

## RxNgQueryStore
RxNgQueryStore is the manager and the bridge to each store.
it provides methods to each store we declared.
<table>
<thead>
<tr>
<th>method</th>
<th>supports</th>
<th>description</th>
</tr>
</thead>
<tbody>
<tr>
<th>registerStore(options: RxQueryOption):void</th>
<td>both</td>
<td>create store</td>
</tr>

<tr>
<th>unregisterStore(key: string):void</th>
<td>both</td>
<td>destroy store, if keepAlive is true, the state can be cached</td>
</tr>

<tr>
<th>has(key: string):boolean</th>
<td>both</td>
<td>check for store existance</td>
</tr>

<tr>
<th>getInitData(key: string):any</th>
<td>both</td>
<td>get the initdata of the store you inject on registration</td>
</tr>

<tr>
<th>reset(key: string):void</th>
<td>both</td>
<td>reset the store, remove cache & all the flag to the start state</td>
</tr>

<tr>
<th>select(key: string, selector?:(s: any) => any):Observable&lt;RxQueryStatus['data']&gt;</th>
<td>both</td>
<td>select from status.data, selector is mapping function</td>
</tr>

<tr>
<th>status(key: string):Observable&lt;RxQueryStatus&gt;</th>
<td>both</td>
<td>select from status.data, selector is mapping function</td>
</tr>

<tr>
<th>mutate(key: string, fn:&lt;RxQueryStatus['data']&gt;) => &lt;RxQueryStatus['data']&gt;):boolean</th>
<td>both</td>
<td>use to manually mutate the data, if the query is executing, it can be denied and the result of success returned</td>
</tr>

<tr>
<th>fetch(key: string, param: any) => void</th>
<td>both</td>
<td>fetch with new param</td>
</tr>

<tr>
<th>refetch(key: string) => void</th>
<td>RxQuery only</td>
<td>refetch with latest param, it can reset the refetchInterval</td>
</tr>

<tr>
<th>disableRefetch(key: string, disabled: boolean) => void</th>
<td>RxQuery only</td>
<td>pause refetch or not</td>
</tr>
</tbody>
</table>




## rxNgSuspense

### RxQueryStatus
status(key) 로 해당 스트림을 얻을 수 있다.
- data: returned data from query
- ts: timestamp that updated (in case of error, it does not update the ts)
- error: thrown error from query (it is reset on loading status)
- loading: loading status
- untrustedData: if data is same as initdata or error on fetch (in case of refetch, it keeps the current one)

### Crate Template with ng-template
```html
// in template
<div>
  <ng-template
    [rxNgSuspense]="rxNgQueryStore.status('key') | async"
    [loadingTemplate]="loadingTemplate"
    [errorTemplate]="errorTemplate"
    let-data
  >
    <div>{{ data.name }}</div>
  </ng-template>
  <ng-template #loadingTemplate>isLoading...</ng-template>
  <ng-template #errorTemplate>isError...</ng-template>
</div>
```

ng-template with rxNgSuspense takes store's status and renders on the data.
if content is ready the data you stored can be received template variable let-variableName

### templateSort

`TemplateType: 'null' | 'loading' | 'content' | 'error'`<br />
rxNgSuspense also takes templateSort function((s: RxQueryStatus<any>): TemplateType)

```typescript
defaultTemplateSort(status: RxQueryStatus<any>){
  const { loading, data, error, untrustedData } = status;
  if (untrustedData) {
    if (error) {
      return 'error';
    }
    if (loading) {
      return 'loading';
    }
    
    return data ? 'content' : 'null';
  }
  
  if (data) {
    return 'content';
  }
  return 'null';
}
```

