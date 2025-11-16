# Portfolio Tracker Frontend

Modern, responsive frontend for the portfolio tracker application built with Alpine.js and Tailwind CSS.

## Features

- **Modern UI**: Material Design-inspired interface with Geist Sans font
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Calculations**: Live portfolio value and gain/loss calculations
- **Interactive Modals**: Beautiful modal forms for adding/editing holdings
- **Price Fetching**: Integration with Yahoo Finance API for current prices
- **Smooth Animations**: Hover effects, transitions, and loading states
- **Form Validation**: Client-side validation with clear error messages
- **Version Transparency**: Clean interface while backend maintains full history

## Tech Stack

- **Alpine.js**: Lightweight, reactive JavaScript framework
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Geist Sans**: Modern, clean font family
- **Vanilla JavaScript**: No complex build tools required
- **Responsive Grid**: Mobile-first design approach

## File Structure

```
frontend/
├── static/
│   └── script.js          # Main Alpine.js application logic
├── templates/
│   ├── index.html         # Main portfolio view with modal
│   └── edit.html          # Standalone edit form
├── package.json           # Project metadata
└── README.md              # This file
```

## Key Components

### Portfolio Tracker (`script.js`)
- **Data Management**: Holdings loading, filtering, and sorting
- **Modal System**: Add/edit modal with form handling
- **API Integration**: Complete CRUD operations with backend
- **Real-time Updates**: Automatic portfolio calculations
- **Error Handling**: User-friendly error messages
- **Price Fetching**: Yahoo Finance integration

### Main View (`index.html`)
- **Portfolio Table**: Sortable, filterable holdings display
- **Stats Cards**: Total value, gain/loss overview
- **Account Filtering**: Filter by account type and category
- **Search Functionality**: Real-time search across holdings
- **Modal Integration**: Seamless add/edit experience

### Edit Form (`edit.html`)
- **Standalone Form**: Direct access for editing specific holdings
- **Form Sections**: Organized input fields (Account, Asset, Financial)
- **Calculated Values**: Live value and gain/loss display
- **Price Fetching**: Integrated Yahoo Finance price lookup

## Development

### Local Development

Since this is a static frontend, you can serve it in several ways:

1. **Python HTTP Server** (Recommended):
   ```bash
   npm run dev
   # or
   python -m http.server 3000
   ```

2. **Live Server** (VS Code Extension):
   - Install "Live Server" extension
   - Right-click `index.html` and select "Open with Live Server"

3. **Node.js Server**:
   ```bash
   npx serve .
   ```

### Backend Integration

The frontend expects the backend API to be running. Default configuration:

- **Backend URL**: `http://localhost:5001`
- **API Endpoints**: `/api/holdings`, `/api/fetch-price`

To connect to a different backend URL, update the `fetch` calls in `script.js`:

```javascript
const response = await fetch('http://your-backend-url:port/api/holdings');
```

### Customization

#### Colors and Styling
Update the Tailwind CSS classes in the HTML files to match your brand:

```html
<!-- Primary colors -->
class="bg-gradient-to-r from-blue-500 to-purple-600"

<!-- Account type colors -->
const colors = {
    'RRSP': '#F59E0B',
    'TFSA': '#3B82F6', 
    'Cash': '#10B981',
    'Crypto': '#8B5CF6',
    'Non-registered': '#6B7280'
};
```

#### Font
The font is set to Geist Sans. To change it:

1. Update the Google Fonts import:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=YourFont:wght@300;400;500;600;700&display=swap" rel="stylesheet">
   ```

2. Update the CSS:
   ```css
   body { font-family: 'YourFont', sans-serif; }
   ```

## Features Overview

### Adding Holdings
1. Click "Add Holding" button
2. Fill in account information
3. Enter asset details
4. Set financial data
5. Use "Fetch" for current prices
6. See real-time calculations
7. Save to create new holding

### Editing Holdings
1. Click "Edit" button in any holding row
2. Modify any field
3. See updated calculations instantly
4. Save to create new version (backend maintains history)

### Deleting Holdings
1. Edit the holding
2. Click red "Delete" button
3. Confirm deletion
4. Holding is soft-deleted (preserved in backend)

### Portfolio Calculations
- **Current Value**: `shares × current_price`
- **Absolute Gain**: `current_value - cost`
- **Relative Gain**: `(absolute_gain / cost) × 100`
- **Portfolio Percentage**: `(holding_value / total_portfolio_value) × 100`

## Browser Support

- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **ES6+ Features**: Uses modern JavaScript (async/await, arrow functions)
- **CSS Features**: CSS Grid, Flexbox, Custom Properties

## Performance

- **Lightweight**: No build process, minimal dependencies
- **Fast Loading**: Uses CDN for Alpine.js and Tailwind CSS
- **Efficient**: Alpine.js reactive updates only when needed
- **Optimized**: Debounced search, efficient DOM manipulation

## Deployment

### Static Hosting
Since this is a static frontend, it can be deployed on any static hosting service:

- **Netlify**: Drag and drop the frontend folder
- **Vercel**: Connect Git repository or upload files
- **GitHub Pages**: Use `gh-pages` branch
- **AWS S3**: Enable static website hosting
- **Firebase Hosting**: `firebase deploy`

### Configuration for Production
1. Update backend API URLs in `script.js`
2. Ensure CORS is configured on the backend
3. Consider using HTTPS for production
4. Optimize images and assets if needed

## Contributing

1. Keep the Alpine.js components organized
2. Follow the existing naming conventions
3. Ensure responsive design for all new features
4. Test on different screen sizes
5. Maintain the clean, modern aesthetic

## License

MIT License
