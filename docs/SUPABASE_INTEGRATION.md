# Supabase Integration Guide

## 🔗 Connecting Supabase with Glide API Gateway

This guide shows how to integrate Supabase with your Glide API Gateway for bidirectional data sync.

## 📋 Prerequisites

- Supabase project with database access
- Glide API Gateway deployed
- n8n for workflow automation (optional)

## 🗄️ Database Schema Setup

### Create Glide Sync Table

```sql
-- Create table for Glide data sync
CREATE TABLE glide_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  glide_row_id VARCHAR(255) UNIQUE NOT NULL,
  glide_table_name VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  order_date TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  account_id VARCHAR(255),
  total_amount DECIMAL(10,2),
  is_paid BOOLEAN DEFAULT false,
  pdf_url TEXT,
  short_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_glide_orders_row_id ON glide_orders(glide_row_id);
CREATE INDEX idx_glide_orders_sync ON glide_orders(synced_at);
CREATE INDEX idx_glide_orders_account ON glide_orders(account_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_glide_orders_updated_at
  BEFORE UPDATE ON glide_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Create Sync Log Table

```sql
-- Create table for sync logging
CREATE TABLE sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'glide_to_supabase' or 'supabase_to_glide'
  table_name VARCHAR(255) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_success INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'running' -- 'running', 'completed', 'failed'
);

CREATE INDEX idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
```

## 🔄 n8n Workflow Configurations

### 1. Glide → Supabase Sync

**Workflow**: `Glide to Supabase Sync`

#### Step 1: Query Glide Data
**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://your-domain:3000/api/execute",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
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
}
```

#### Step 2: Transform Data
**Function Node:**
```javascript
// Transform Glide data to Supabase format
const glideData = $input.first().json;
const rows = glideData[0].rows;

const transformedRows = rows.map(row => ({
  glide_row_id: row.$rowID,
  glide_table_name: 'native-table-sgCH7hxbStWPIel1YC1Q',
  name: row.Name,
  order_date: row.Y8Sjq,
  payment_date: row.Q5P0U,
  account_id: row.WB6a4,
  total_amount: parseFloat(row.totalAmount) || 0,
  is_paid: row.m7Lh0 || false,
  pdf_url: row.vGz0K,
  short_link: row.WU9FJ,
  synced_at: new Date().toISOString()
}));

return transformedRows;
```

#### Step 3: Upsert to Supabase
**Supabase Node:**
```json
{
  "operation": "upsert",
  "table": "glide_orders",
  "conflict_columns": ["glide_row_id"],
  "data": "{{ $json }}"
}
```

### 2. Supabase → Glide Sync

**Workflow**: `Supabase to Glide Sync`

#### Step 1: Query Supabase Changes
**Supabase Node:**
```json
{
  "operation": "select",
  "table": "glide_orders",
  "filters": {
    "updated_at": {
      "operator": "gte",
      "value": "{{ $json.last_sync_time }}"
    }
  }
}
```

#### Step 2: Transform to Glide Format
**Function Node:**
```javascript
// Transform Supabase data to Glide mutations
const supabaseData = $input.all();
const mutations = supabaseData.map(item => {
  const row = item.json;
  
  return {
    kind: "set-columns-in-row",
    tableName: "native-table-sgCH7hxbStWPIel1YC1Q",
    rowID: row.glide_row_id,
    columnValues: {
      Name: row.name,
      Y8Sjq: row.order_date,
      Q5P0U: row.payment_date,
      WB6a4: row.account_id,
      m7Lh0: row.is_paid,
      vGz0K: row.pdf_url,
      WU9FJ: row.short_link,
      ObAgH: new Date().toISOString()
    }
  };
});

return {
  appID: "KyQIgjT4O1JsARXgkzsv",
  mutations: mutations.slice(0, 500) // Max 500 mutations
};
```

#### Step 3: Update Glide
**HTTP Request Node:**
```json
{
  "method": "POST",
  "url": "http://your-domain:3000/api/execute",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "api_name": "glide-api-v1",
    "method": "POST",
    "path": "/mutateTables",
    "data": "{{ $json }}"
  }
}
```

### 3. Real-time Sync with Database Triggers

#### Supabase Database Function
```sql
-- Create function to handle real-time sync
CREATE OR REPLACE FUNCTION notify_glide_sync()
RETURNS trigger AS $$
BEGIN
  -- Send notification to n8n webhook
  PERFORM pg_notify(
    'glide_sync',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'data', row_to_json(NEW)
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for real-time sync
CREATE TRIGGER glide_sync_trigger
  AFTER INSERT OR UPDATE OR DELETE ON glide_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_glide_sync();
```

#### n8n Webhook Listener
**Webhook Node Configuration:**
- **HTTP Method**: POST
- **Path**: `/glide-sync`
- **Response Mode**: Respond to Webhook

**Function Node (Process Webhook):**
```javascript
// Process real-time sync notification
const notification = $input.first().json;
const { table, action, data } = notification;

if (action === 'UPDATE' && table === 'glide_orders') {
  return {
    sync_needed: true,
    glide_row_id: data.glide_row_id,
    changes: data
  };
}

return { sync_needed: false };
```

## 🎯 Advanced Integration Patterns

### 1. Conflict Resolution

```javascript
// Function Node for Conflict Resolution
const glideData = $input.first().json;
const supabaseData = $input.last().json;

const conflicts = [];
const resolved = [];

glideData.forEach(glideRow => {
  const supabaseRow = supabaseData.find(sb => 
    sb.glide_row_id === glideRow.$rowID
  );
  
  if (supabaseRow) {
    // Check for conflicts based on updated_at
    const glideUpdated = new Date(glideRow.ObAgH);
    const supabaseUpdated = new Date(supabaseRow.updated_at);
    
    if (glideUpdated > supabaseUpdated) {
      resolved.push({
        source: 'glide',
        data: glideRow
      });
    } else if (supabaseUpdated > glideUpdated) {
      resolved.push({
        source: 'supabase',
        data: supabaseRow
      });
    } else {
      conflicts.push({
        glide: glideRow,
        supabase: supabaseRow
      });
    }
  }
});

return { resolved, conflicts };
```

### 2. Batch Processing

```javascript
// Function Node for Batch Processing
const items = $input.all();
const batchSize = 100;
const batches = [];

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  batches.push({
    batch_id: Math.floor(i / batchSize) + 1,
    total_batches: Math.ceil(items.length / batchSize),
    items: batch
  });
}

return batches;
```

### 3. Data Validation

```javascript
// Function Node for Data Validation
const data = $input.first().json;
const errors = [];

// Validate required fields
if (!data.glide_row_id) {
  errors.push('Missing glide_row_id');
}

if (!data.name) {
  errors.push('Missing name');
}

// Validate data types
if (data.total_amount && isNaN(parseFloat(data.total_amount))) {
  errors.push('Invalid total_amount');
}

// Validate dates
if (data.order_date && !Date.parse(data.order_date)) {
  errors.push('Invalid order_date format');
}

if (errors.length > 0) {
  throw new Error(`Validation failed: ${errors.join(', ')}`);
}

return data;
```

## 📊 Monitoring & Analytics

### Sync Status Dashboard Query

```sql
-- Get sync statistics
SELECT 
  sync_type,
  DATE_TRUNC('day', started_at) as sync_date,
  COUNT(*) as total_syncs,
  SUM(records_processed) as total_records,
  SUM(records_success) as successful_records,
  SUM(records_failed) as failed_records,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM sync_logs
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY sync_type, DATE_TRUNC('day', started_at)
ORDER BY sync_date DESC;
```

### Data Freshness Check

```sql
-- Check data freshness
SELECT 
  COUNT(*) as total_records,
  MAX(synced_at) as last_sync,
  AGE(NOW(), MAX(synced_at)) as sync_age,
  COUNT(CASE WHEN synced_at < NOW() - INTERVAL '1 hour' THEN 1 END) as stale_records
FROM glide_orders;
```

## 🔐 Security & Best Practices

### 1. Row Level Security (RLS)

```sql
-- Enable RLS on glide_orders table
ALTER TABLE glide_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for service role
CREATE POLICY "Service role can manage glide_orders"
ON glide_orders FOR ALL
TO service_role
USING (true);

-- Create policy for authenticated users (read-only)
CREATE POLICY "Authenticated users can read glide_orders"
ON glide_orders FOR SELECT
TO authenticated
USING (true);
```

### 2. API Key Management

```javascript
// Function Node for API Key Rotation
const currentKey = $vars.GLIDE_API_KEY;
const backupKey = $vars.GLIDE_API_KEY_BACKUP;

try {
  // Try with current key
  const response = await $http.request({
    method: 'POST',
    url: 'http://your-domain:3000/health',
    headers: { 'Authorization': `Bearer ${currentKey}` }
  });
  
  return { key: currentKey, status: 'active' };
} catch (error) {
  // Fallback to backup key
  return { key: backupKey, status: 'fallback' };
}
```

### 3. Error Handling & Retry Logic

```javascript
// Function Node for Retry Logic
const maxRetries = 3;
const currentRetry = $json.retry_count || 0;

if (currentRetry >= maxRetries) {
  throw new Error(`Max retries exceeded after ${maxRetries} attempts`);
}

return {
  ...($json),
  retry_count: currentRetry + 1,
  delay: Math.pow(2, currentRetry) * 1000 // Exponential backoff
};
```

## 🚨 Common Issues & Solutions

### Issue: Sync Loops
**Solution**: Implement sync timestamps and direction flags.

### Issue: Data Type Mismatches
**Solution**: Create transformation functions for each data type.

### Issue: Large Dataset Performance
**Solution**: Use pagination and batch processing.

### Issue: Network Timeouts
**Solution**: Implement retry logic with exponential backoff.

## 📈 Performance Optimization

### 1. Database Indexing

```sql
-- Add indexes for better query performance
CREATE INDEX idx_glide_orders_updated_at ON glide_orders(updated_at);
CREATE INDEX idx_glide_orders_account_date ON glide_orders(account_id, order_date);
CREATE INDEX idx_glide_orders_sync_status ON glide_orders(synced_at) WHERE synced_at IS NOT NULL;
```

### 2. Query Optimization

```sql
-- Use materialized views for complex queries
CREATE MATERIALIZED VIEW glide_orders_summary AS
SELECT 
  account_id,
  COUNT(*) as total_orders,
  SUM(total_amount) as total_amount,
  COUNT(CASE WHEN is_paid THEN 1 END) as paid_orders,
  MAX(order_date) as last_order_date
FROM glide_orders
GROUP BY account_id;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW glide_orders_summary;
```

### 3. Connection Pooling

```javascript
// Use connection pooling in n8n
const pool = new Pool({
  connectionString: $vars.SUPABASE_CONNECTION_STRING,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```