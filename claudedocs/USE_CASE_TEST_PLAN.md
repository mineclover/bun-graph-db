# Use Case Based Testing Plan

## Test Scenarios

### Use Case 1: Personal Knowledge Graph
**Scenario**: Building a personal knowledge base with interconnected notes, tags, and references

**Workflow**:
1. Create "Notes" table with attributes (title, content, created_date, tags)
2. Create "Tags" table with attributes (name, color)
3. Create multiple note nodes
4. Create relationships: note → references → note
5. Create relationships: note → has_tag → tag
6. Search notes by content
7. Find all notes with specific tag
8. Traverse: find all notes related to a note (2-3 hops)
9. Create template for "add note with tags"

**Expected Results**:
- ✅ Tables created with proper schema
- ✅ Nodes created with attributes
- ✅ Relationships established
- ✅ Search finds relevant notes
- ✅ Graph traversal returns connected notes
- ✅ Template executes successfully

---

### Use Case 2: Project Management System
**Scenario**: Managing projects, tasks, and team members with dependencies

**Workflow**:
1. Create "Projects" table (name, status, deadline)
2. Create "Tasks" table (title, description, priority, status)
3. Create "People" table (name, role, email)
4. Create project nodes
5. Create task nodes linked to projects
6. Create person nodes
7. Relationships: task → assigned_to → person
8. Relationships: task → depends_on → task
9. Relationships: task → belongs_to → project
10. Query: Find all tasks assigned to a person
11. Query: Find task dependencies (critical path)
12. Template: "Create task with assignment"

**Expected Results**:
- ✅ Complex multi-table schema works
- ✅ Multiple relationship types supported
- ✅ Dependency chains can be queried
- ✅ Assignment relationships tracked
- ✅ Templates handle multi-step operations

---

### Use Case 3: Recipe Database with Ingredients
**Scenario**: Recipe collection with ingredient tracking and nutritional info

**Workflow**:
1. Create "Recipes" table (name, cuisine, difficulty, cook_time)
2. Create "Ingredients" table (name, category, unit)
3. Create "NutritionalInfo" table (calories, protein, carbs, fat)
4. Create recipe nodes
5. Create ingredient nodes
6. Relationships: recipe → uses → ingredient (with quantity attribute)
7. Relationships: recipe → has_nutrition → nutritional_info
8. Query: Find recipes with specific ingredient
9. Query: Find recipes by cuisine type
10. Advanced: Find recipes sharing >3 ingredients
11. Template: "Add recipe with ingredients"

**Expected Results**:
- ✅ Relationship attributes work (quantity)
- ✅ Multi-attribute search works
- ✅ Complex graph queries succeed
- ✅ Template handles nested creation

---

## Testing Methodology

### Phase 1: Schema Setup
- Create tables
- Define attributes with proper types
- Verify schema introspection

### Phase 2: Data Population
- Create representative nodes
- Set attribute values
- Verify data integrity

### Phase 3: Relationship Building
- Create typed relationships
- Test bidirectional queries
- Verify relationship counts

### Phase 4: Query Testing
- Simple searches (text, attributes)
- Complex filters (multiple conditions)
- Graph traversal (depth, direction)
- Path finding (shortest path)

### Phase 5: Template Usage
- Create reusable templates
- Execute with different parameters
- Verify template results

### Phase 6: Advanced Features
- Batch operations
- Export/import
- MCP tool integration

---

## Success Criteria

For each use case:
- [ ] All tables created successfully
- [ ] All attributes defined correctly
- [ ] All nodes created with proper data
- [ ] All relationships established
- [ ] Search queries return expected results
- [ ] Graph traversal works correctly
- [ ] Templates execute successfully
- [ ] Performance is acceptable (<100ms for simple queries)

---

## Test Execution Timeline

1. **Use Case 1** (30 min): Knowledge Graph
2. **Use Case 2** (30 min): Project Management
3. **Use Case 3** (30 min): Recipe Database
4. **Advanced Testing** (30 min): Graph algorithms, templates
5. **Report Generation** (15 min): Document findings

**Total**: ~2 hours
