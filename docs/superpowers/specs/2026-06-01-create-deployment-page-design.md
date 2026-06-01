# Create Deployment Page Design

## Goal

Extract the create-deployment modal (`CreateDeploymentModal`) into a standalone `/create` route page, keeping all existing functionality intact.

## Changes

### New file: `CreateDeploymentPage.tsx`

- Copy the form content from `CreateDeploymentModal.tsx`
- Remove `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` wrapper
- Use a plain page container (`div className="space-y-6"`) matching other pages
- Remove `open`/`onClose` props, control via routing
- Read `?image=` from URL search params for prefill (same as current modal)
- "取消" button navigates back (`navigate('/deployments')`)
- "创建" button calls `api.createDeployment(...)` then navigates to detail page: `navigate('/deployments/${name}?namespace=${ns}')`

### Modified: `App.tsx`

- Add route: `<Route path="/create" element={<CreateDeploymentPage />} />`

### Modified: `DeploymentsPage.tsx`

- Replace `setShowCreate(true)` → `navigate('/create')`
- Remove `showCreate` and `prefillImage` state
- Remove `useSearchParams` (image param handling moves to `/create` page)
- Remove `CreateDeploymentModal` import and JSX

### Modified: `ImagesPage.tsx`

- Change `navigate('/deployments?image=...')` → `navigate('/create?image=...')`

### Deleted: `CreateDeploymentModal.tsx`

- No longer needed; functionality lives in the new page

## Data Flow

```
ImagesPage            → navigate('/create?image=xxx')
DeploymentsPage       → navigate('/create')
CreateDeploymentPage  → api.createDeployment() → navigate('/deployments/{name}?namespace={ns}')
```

## Layout

The `/create` page renders inside the existing `AppLayout` (with sidebar). No additional title is added to the page — the button on DeploymentsPage remains the entry point.

## Non-Goals

- No behavior changes to form fields, validation, or API calls
- No visual redesign of the form
- No retention of the modal variant
