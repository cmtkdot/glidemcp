# n8n Integration Guide

## 🔗 Connecting n8n to Glide API Gateway

This guide shows how to integrate n8n with your Glide API Gateway for automated workflows.

## 📋 Prerequisites

- n8n instance running
- Glide API Gateway deployed on Hostinger
- Your gateway URL: `http://your-domain:3000`

## 🛠️ HTTP Request Node Configuration

### Basic Setup

1. **Add HTTP Request Node**
2. **Configure Request:**
   - **Method**: `POST`
   - **URL**: `http://your-domain:3000/api/execute`
   - **Headers**: `Content-Type: application/json`

### Query Glide Tables

```json
{
  "api_name": "glide-api-v1",
  "method": "POST",
  "path": "/queryTables",
  "data": {
    "appID": "KyQIgjT4O1JsARXgkzsv",
    "queries": [
      {
        "tableName": "native-table-sgCH7hxbStWPIel1YC1Q",
        "utc": true
      }
    ]
  }
}
```

### Add Row to Glide Table

```json
{
  "api_name": "glide-api-v1",
  "method": "POST",
  "path": "/mutateTables",
  "data": {
    "appID": "KyQIgjT4O1JsARXgkzsv",
    "mutations": [
      {
        "kind": "add-row-to-table",
        "tableName": "native-table-sgCH7hxbStWPIel1YC1Q",
        "columnValues": {
          "Name": "{{ $json.customerName }}",
          "Y8Sjq": "{{ $json.orderDate }}",
          "Q5P0U": "{{ $json.paymentDate }}",
          "WB6a4": "{{ $json.accountId }}"
        }
      }
    ]
  }
}
```

### Update Existing Row

```json
{
  "api_name": "glide-api-v1",
  "method": "POST",
  "path": "/mutateTables",
  "data": {
    "appID": "KyQIgjT4O1JsARXgkzsv",
    "mutations": [
      {
        "kind": "set-columns-in-row",
        "tableName": "native-table-sgCH7hxbStWPIel1YC1Q",
        "rowID": "{{ $json.rowId }}",
        "columnValues": {
          "m7Lh0": true,
          "ObAgH": "{{ $now }}"
        }
      }
    ]
  }
}
```

### Delete Row

```json
{
  "api_name": "glide-api-v1",
  "method": "POST",
  "path": "/mutateTables",
  "data": {
    "appID": "KyQIgjT4O1JsARXgkzsv",
    "mutations": [
      {
        "kind": "delete-row",
        "tableName": "native-table-sgCH7hxbStWPIel1YC1Q",
        "rowID": "{{ $json.rowId }}"
      }
    ]
  }
}
```

## 🔄 Common Workflow Patterns

### 1. Form Submission → Glide Table

```
Webhook → Function → HTTP Request (Add Row) → Response
```

**Function Node (Data Transformation):**
```javascript
return {
  customerName: $input.first().json.name,
  orderDate: new Date().toISOString(),
  paymentDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
  accountId: $input.first().json.customer_id
};
```

### 2. Scheduled Sync: External API → Glide

```
Cron → HTTP Request (External API) → Function → HTTP Request (Glide)
```

**Function Node (Batch Processing):**
```javascript
const externalData = $input.first().json;
const mutations = externalData.orders.map(order => ({
  kind: "add-row-to-table",
  tableName: "native-table-sgCH7hxbStWPIel1YC1Q",
  columnValues: {
    Name: `PO#${order.id}`,
    Y8Sjq: order.date,
    Q5P0U: order.payment_date,
    WB6a4: order.account_id
  }
}));

return {
  appID: "KyQIgjT4O1JsARXgkzsv",
  mutations: mutations.slice(0, 500) // Max 500 mutations
};
```

### 3. Glide Data → External System

```
Cron → HTTP Request (Query Glide) → Function → HTTP Request (External API)
```

**Function Node (Data Export):**
```javascript
const glideData = $input.first().json;
const exportData = glideData[0].rows.map(row => ({
  id: row.$rowID,
  name: row.Name,
  date: row.Y8Sjq,
  amount: row.totalAmount || 0,
  paid: row.m7Lh0 || false
}));

return { records: exportData };
```

## 🎯 Advanced Features

### Error Handling

```javascript
// Function Node for Error Handling
const response = $input.first().json;

if (response.error) {
  throw new Error(`Glide API Error: ${response.error}`);
}

// Check for mutation errors
if (response[0] && response[0].error) {
  throw new Error(`Mutation failed: ${response[0].error}`);
}

return response;
```

### Pagination Support

```javascript
// Function Node for Pagination
const previousResponse = $input.first().json;
const hasMore = previousResponse[0].next;

if (hasMore) {
  return {
    appID: "KyQIgjT4O1JsARXgkzsv",
    queries: [{
      tableName: "native-table-sgCH7hxbStWPIel1YC1Q",
      startAt: hasMore,
      utc: true
    }]
  };
}

return null; // Stop pagination
```

### Batch Operations

```javascript
// Function Node for Batching
const items = $input.all();
const batchSize = 100;
const batches = [];

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const mutations = batch.map(item => ({
    kind: "add-row-to-table",
    tableName: "native-table-sgCH7hxbStWPIel1YC1Q",
    columnValues: {
      Name: item.json.name,
      Y8Sjq: item.json.date
    }
  }));
  
  batches.push({
    appID: "KyQIgjT4O1JsARXgkzsv",
    mutations
  });
}

return batches;
```

## 🔐 Security Best Practices

1. **Environment Variables**: Store API keys in n8n environment variables
2. **IP Whitelisting**: Restrict access to your gateway
3. **Rate Limiting**: Monitor API usage
4. **Error Logging**: Log failures for debugging

## 📊 Monitoring & Debugging

### Health Check Workflow

```
Cron (every 5 min) → HTTP Request (Health) → IF → Email/Slack Alert
```

**HTTP Request:**
```json
{
  "method": "GET",
  "url": "http://your-domain:3000/health"
}
```

### Usage Analytics

```javascript
// Function Node for Usage Tracking
const response = $input.first().json;
const usage = {
  timestamp: new Date().toISOString(),
  endpoint: $json.path,
  success: !response.error,
  rowCount: response[0]?.rows?.length || 0
};

return usage;
```

## 🚨 Common Issues & Solutions

### Issue: "API 'glide-api-v1' not found"
**Solution**: Check that your gateway is running and environment variables are set correctly.

### Issue: Rate Limiting
**Solution**: Add delays between requests or implement queuing.

### Issue: Large Datasets
**Solution**: Use pagination with `startAt` parameter.

### Issue: Timeout Errors
**Solution**: Increase n8n timeout settings or implement retry logic.

## 📝 Example Workflows

### Complete Order Processing
1. **Trigger**: Webhook receives order
2. **Transform**: Format data for Glide
3. **Store**: Add to Glide table
4. **Notify**: Send confirmation email
5. **Sync**: Update external CRM

### Daily Reporting
1. **Trigger**: Cron daily at 9 AM
2. **Query**: Get all orders from yesterday
3. **Process**: Calculate totals and metrics
4. **Report**: Send summary to Slack/Email

### Real-time Sync
1. **Trigger**: Webhook from external system
2. **Check**: Verify data integrity
3. **Update**: Modify Glide table
4. **Confirm**: Send success response