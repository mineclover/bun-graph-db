#!/bin/bash

# Test script for AttributeType functionality
# Usage: ./test-attribute-types.sh

echo "🧪 Testing AttributeType Management System"
echo "========================================="

# Configuration
HOST="localhost"
PORT="4000"
ENDPOINT="http://$HOST:$PORT/graphql"

# Test 1: Create a Table first
echo -e "\n1️⃣ Creating test table..."
TABLE_RESPONSE=$(curl -s -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateTestTable($input: CreateTableInput!) { createTable(input: $input) { success table { id identifier description } errors { message code } } }",
    "variables": {
      "input": {
        "identifier": "test_table_attributes",
        "description": "Test table for attribute types"
      }
    }
  }')

echo "Response: $TABLE_RESPONSE"
TABLE_ID=$(echo $TABLE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Created table with ID: $TABLE_ID"

# Test 2: Create AttributeType for string
echo -e "\n2️⃣ Creating AttributeType (string)..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateStringAttributeType($input: CreateAttributeTypeInput!) { createAttributeType(input: $input) { success attributeType { id identifier name dataType constraints defaultValue } errors { message code } } }",
    "variables": {
      "input": {
        "identifier": "string_type",
        "name": "String Type",
        "description": "Basic string attribute type",
        "dataType": "string",
        "constraints": {
          "minLength": 1,
          "maxLength": 255
        },
        "defaultValue": ""
      }
    }
  }' | jq '.'

# Test 3: Create AttributeType for number
echo -e "\n3️⃣ Creating AttributeType (number)..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateNumberAttributeType($input: CreateAttributeTypeInput!) { createAttributeType(input: $input) { success attributeType { id identifier name dataType constraints defaultValue } errors { message code } } }",
    "variables": {
      "input": {
        "identifier": "number_type",
        "name": "Number Type",
        "description": "Numeric attribute type",
        "dataType": "number",
        "constraints": {
          "min": 0,
          "max": 1000000
        },
        "defaultValue": "0"
      }
    }
  }' | jq '.'

# Test 4: Create AttributeType for boolean
echo -e "\n4️⃣ Creating AttributeType (boolean)..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateBooleanAttributeType($input: CreateAttributeTypeInput!) { createAttributeType(input: $input) { success attributeType { id identifier name dataType constraints defaultValue } errors { message code } } }",
    "variables": {
      "input": {
        "identifier": "boolean_type",
        "name": "Boolean Type",
        "description": "Boolean attribute type",
        "dataType": "boolean",
        "constraints": null,
        "defaultValue": "false"
      }
    }
  }' | jq '.'

# Test 5: Create AttributeType for date
echo -e "\n5️⃣ Creating AttributeType (date)..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateDateAttributeType($input: CreateAttributeTypeInput!) { createAttributeType(input: $input) { success attributeType { id identifier name dataType constraints defaultValue } errors { message code } } }",
    "variables": {
      "input": {
        "identifier": "date_type",
        "name": "Date Type",
        "description": "Date attribute type",
        "dataType": "date",
        "constraints": {
          "format": "ISO8601"
        },
        "defaultValue": null
      }
    }
  }' | jq '.'

# Test 6: Query all AttributeTypes
echo -e "\n6️⃣ Querying all AttributeTypes..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetAllAttributeTypes { attributeTypes { nodes { id identifier name description dataType constraints defaultValue createdAt updatedAt } totalCount hasNextPage hasPreviousPage } }"
  }' | jq '.'

# Test 7: Query AttributeType by identifier
echo -e "\n7️⃣ Querying AttributeType by identifier..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetAttributeTypeByIdentifier($identifier: String!) { attributeTypeByIdentifier(identifier: $identifier) { id identifier name description dataType constraints defaultValue } }",
    "variables": {
      "identifier": "string_type"
    }
  }' | jq '.'

# Test 8: Create Attributes using the AttributeTypes
echo -e "\n8️⃣ Creating Attributes with AttributeTypes..."

# Get AttributeType IDs
STRING_TYPE_RESPONSE=$(curl -s -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { attributeTypeByIdentifier(identifier: \"string_type\") { id } }"
  }')
STRING_TYPE_ID=$(echo $STRING_TYPE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

NUMBER_TYPE_RESPONSE=$(curl -s -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { attributeTypeByIdentifier(identifier: \"number_type\") { id } }"
  }')
NUMBER_TYPE_ID=$(echo $NUMBER_TYPE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

# Create string attribute
echo -e "\n  Creating 'name' attribute..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation CreateAttribute(\$input: CreateAttributeInput!) { createAttribute(input: \$input) { success attribute { id identifier name attributeType { identifier name dataType } table { identifier } } errors { message code } } }\",
    \"variables\": {
      \"input\": {
        \"identifier\": \"name_attr\",
        \"name\": \"Name\",
        \"description\": \"Name attribute\",
        \"attributeTypeId\": \"$STRING_TYPE_ID\",
        \"tableId\": \"$TABLE_ID\"
      }
    }
  }" | jq '.'

# Create number attribute
echo -e "\n  Creating 'age' attribute..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation CreateAttribute(\$input: CreateAttributeInput!) { createAttribute(input: \$input) { success attribute { id identifier name attributeType { identifier name dataType } table { identifier } } errors { message code } } }\",
    \"variables\": {
      \"input\": {
        \"identifier\": \"age_attr\",
        \"name\": \"Age\",
        \"description\": \"Age attribute\",
        \"attributeTypeId\": \"$NUMBER_TYPE_ID\",
        \"tableId\": \"$TABLE_ID\"
      }
    }
  }" | jq '.'

# Test 9: Query Table with attributeTypes
echo -e "\n9️⃣ Querying Table with its AttributeTypes..."
curl -X POST $ENDPOINT \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"query GetTableWithAttributeTypes(\$id: ID!) { table(id: \$id) { id identifier description attributes { id identifier name attributeType { identifier name dataType } } attributeTypes { id identifier name dataType constraints defaultValue } attributeCount } }\",
    \"variables\": {
      \"id\": \"$TABLE_ID\"
    }
  }" | jq '.'

echo -e "\n✅ Testing complete!"