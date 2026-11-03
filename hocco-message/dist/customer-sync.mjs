// Only server-confirmed entries replace a local copy; failures never erase it.
export function mergeSavedPurchases(state,entries){
 const merge=(rows,kind)=>rows.flatMap(saved=>{const entry=entries.find(e=>e.kind===kind&&e.code===saved.code);if(!entry||entry.unavailable)return[saved];if(entry.expired)return[];if(!entry.record||entry.record.code!==saved.code)return[saved];return[{...saved,...entry.record,trackingToken:saved.trackingToken}];});
 return{orders:merge(state.orders||[],'order'),communityOrders:merge(state.communityOrders||[],'community')};
}
