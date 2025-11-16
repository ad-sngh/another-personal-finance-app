// Portfolio Tracker JavaScript
document.addEventListener('alpine:init', () => {
    // Main Portfolio Tracker Component
    Alpine.data('portfolioTracker', () => ({
        holdings: [],
        filteredHoldings: [],
        stats: {},
        searchTerm: '',
        accountFilter: 'All',
        categoryFilter: 'All',
        showEditModal: false,
        currentHolding: null,
        activeTab: 'holdings',
        accountTypeChart: null,
        portfolioChart: null,
        
        // Edit form data
        editForm: {
            account_type: '',
            account: '',
            ticker: '',
            name: '',
            category: '',
            lookup: '',
            shares: 0,
            cost: 0,
            current_price: 0
        },
        isLoadingPrice: false,
        isSaving: false,
        errorMessage: '',
        
        init() {
            this.loadHoldings();
            this.$watch('searchTerm', () => this.filterHoldings());
            this.$watch('accountFilter', () => this.filterHoldings());
            this.$watch('categoryFilter', () => this.filterHoldings());
            this.$watch('activeTab', (value) => {
                if (value === 'visualizations') {
                    this.$nextTick(() => {
                        this.loadAccountTypeChart();
                        this.loadPortfolioSparkline();
                    });
                }
            });
        },
        
        async loadHoldings() {
            try {
                const response = await fetch('http://localhost:8081/api/holdings');
                const data = await response.json();
                this.holdings = data.holdings;
                this.stats = data.stats;
                this.filteredHoldings = this.holdings;
            } catch (error) {
                console.error('Error loading holdings:', error);
            }
        },
        
        filterHoldings() {
            this.filteredHoldings = this.holdings.filter(holding => {
                const matchesSearch = !this.searchTerm || 
                    holding.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                    (holding.ticker && holding.ticker.toLowerCase().includes(this.searchTerm.toLowerCase()));
                
                const matchesAccount = this.accountFilter === 'All' || holding.account_type === this.accountFilter;
                const matchesCategory = this.categoryFilter === 'All' || holding.category === this.categoryFilter;
                
                return matchesSearch && matchesAccount && matchesCategory;
            });
        },
        
        setAccountFilter(type) {
            this.accountFilter = type;
        },
        
        setCategoryFilter(category) {
            this.categoryFilter = category;
        },
        
        openAddForm() {
            this.currentHolding = null;
            this.showEditModal = true;
        },
        
        editHolding(id) {
            const holding = this.holdings.find(h => h.id === id);
            if (holding) {
                this.currentHolding = holding;
                this.populateForm();
                this.showEditModal = true;
            }
        },
        
        closeEditModal() {
            this.showEditModal = false;
            this.currentHolding = null;
            this.resetForm();
        },
        
        onHoldingSaved() {
            this.closeEditModal();
            this.loadHoldings();
        },
        
        populateForm() {
            if (this.currentHolding) {
                this.editForm = {
                    account_type: this.currentHolding.account_type,
                    account: this.currentHolding.account,
                    ticker: this.currentHolding.ticker || '',
                    name: this.currentHolding.name,
                    category: this.currentHolding.category,
                    lookup: this.currentHolding.lookup || '',
                    shares: this.currentHolding.shares,
                    cost: this.currentHolding.cost,
                    current_price: this.currentHolding.current_price
                };
            } else {
                this.resetForm();
            }
        },
        
        resetForm() {
            this.editForm = {
                account_type: '',
                account: '',
                ticker: '',
                name: '',
                category: '',
                lookup: '',
                shares: 0,
                cost: 0,
                current_price: 0
            };
            this.errorMessage = '';
        },
        
        async fetchPrice() {
            if (!this.editForm.lookup) return;
            
            this.isLoadingPrice = true;
            this.errorMessage = '';
            
            try {
                const response = await fetch('http://localhost:8081/api/fetch-price', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ticker: this.editForm.lookup })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.editForm.current_price = data.price;
                    // Auto-set ticker to lookup value after successful fetch
                    this.editForm.ticker = this.editForm.lookup;
                    // Auto-fill name if it's empty or if lookup ticker matches
                    if (data.name && (!this.editForm.name || this.editForm.name === '')) {
                        this.editForm.name = data.name;
                    }
                } else {
                    const errorData = await response.json();
                    this.errorMessage = errorData.detail || 'Failed to fetch price';
                }
            } catch (error) {
                console.error('Error fetching price:', error);
                this.errorMessage = 'Network error while fetching price';
            } finally {
                this.isLoadingPrice = false;
            }
        },
        
        async saveHolding() {
            this.isSaving = true;
            this.errorMessage = '';
            
            try {
                const url = this.currentHolding ? `http://localhost:8081/api/holdings/${this.currentHolding.id}` : 'http://localhost:8081/api/holdings';
                const method = this.currentHolding ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(this.editForm)
                });
                
                if (response.ok) {
                    this.onHoldingSaved();
                } else {
                    const errorData = await response.json();
                    this.errorMessage = errorData.detail || 'Failed to save holding';
                }
            } catch (error) {
                console.error('Error saving holding:', error);
                this.errorMessage = 'Network error while saving holding';
            } finally {
                this.isSaving = false;
            }
        },
        
        async deleteHolding() {
            if (!this.currentHolding) return;
            
            if (!confirm('Are you sure you want to delete this holding? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch(`http://localhost:8081/api/holdings/${this.currentHolding.id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.onHoldingSaved();
                } else {
                    const errorData = await response.json();
                    this.errorMessage = errorData.detail || 'Failed to delete holding';
                }
            } catch (error) {
                console.error('Error deleting holding:', error);
                this.errorMessage = 'Network error while deleting holding';
            }
        },
        
        getAccountTypeColor(type) {
            const colors = {
                'RRSP': '#F59E0B',
                'TFSA': '#3B82F6', 
                'Cash': '#10B981',
                'Crypto': '#8B5CF6',
                'Non-registered': '#6B7280'
            };
            return colors[type] || '#6B7280';
        },
        
        formatCurrency(value) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);
        },
        
        formatPercentage(value) {
            return new Intl.NumberFormat('en-US', {
                style: 'percent',
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }).format(value / 100);
        },
        
        formatNumber(value) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 8
            }).format(value);
        },

        async loadSparkline(holdingId, ticker) {
            if (!ticker) return;
            
            try {
                const response = await fetch(`http://localhost:8081/api/price-history/${ticker}?days=30`);
                const data = await response.json();
                
                console.log(`Loading sparkline for ${ticker}:`, data);
                
                if (data.history && data.history.length > 0) {
                    this.drawSparkline(`sparkline-${holdingId}`, data.history);
                } else {
                    console.log(`No history data for ${ticker}`);
                }
            } catch (error) {
                console.error('Error loading sparkline:', error);
            }
        },

        drawSparkline(canvasId, history) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.log(`Canvas ${canvasId} not found`);
                return;
            }
            
            console.log(`Drawing sparkline for ${canvasId}:`, history);
            
            const ctx = canvas.getContext('2d');
            const prices = history.reverse().map(h => h.price);
            
            // For single data points, create a small line
            if (prices.length === 1) {
                const price = prices[0];
                const data = [price * 0.95, price, price * 1.05]; // Create small variation
                
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [0, 1, 2],
                        datasets: [{
                            data: data,
                            borderColor: '#10b981',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false }
                        },
                        scales: {
                            x: { display: false },
                            y: { display: false }
                        }
                    }
                });
                return;
            }
            
            // For multiple data points
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: prices.map((_, i) => i),
                    datasets: [{
                        data: prices,
                        borderColor: prices[prices.length - 1] >= prices[0] ? '#10b981' : '#ef4444',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    }
                }
            });
        },

        async loadAccountTypeChart() {
            try {
                const response = await fetch('http://localhost:8081/api/portfolio-by-account-type');
                const data = await response.json();
                
                if (data.account_types) {
                    this.drawAccountTypeChart(data.account_types);
                }
            } catch (error) {
                console.error('Error loading account type chart:', error);
            }
        },

        drawAccountTypeChart(accountTypes) {
            const ctx = document.getElementById('accountTypeChart');
            if (!ctx) return;
            
            if (this.accountTypeChart) {
                this.accountTypeChart.destroy();
            }
            
            this.accountTypeChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: accountTypes.map(at => at.account_type),
                    datasets: [
                        {
                            label: 'Contribution',
                            data: accountTypes.map(at => at.contribution),
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            borderWidth: 1,
                            borderRadius: 8,
                            borderSkipped: false,
                        },
                        {
                            label: 'Current Value',
                            data: accountTypes.map(at => at.value),
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            borderColor: 'rgba(16, 185, 129, 1)',
                            borderWidth: 1,
                            borderRadius: 8,
                            borderSkipped: false,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                    size: 12,
                                    family: "'Geist', sans-serif"
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: {
                                size: 14,
                                family: "'Geist', sans-serif"
                            },
                            bodyFont: {
                                size: 13,
                                family: "'Geist', sans-serif"
                            },
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                padding: 10,
                                callback: function(value) {
                                    return '$' + (value / 1000).toFixed(0) + 'k';
                                },
                                font: {
                                    size: 11,
                                    family: "'Geist', sans-serif"
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            ticks: {
                                padding: 10,
                                font: {
                                    size: 12,
                                    family: "'Geist', sans-serif"
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    }
                }
            });
        },

        async loadPortfolioSparkline() {
            try {
                const response = await fetch('http://localhost:8081/api/portfolio-history?days=30');
                const data = await response.json();
                
                if (data.history && data.history.length > 0) {
                    this.drawPortfolioSparkline(data.history);
                }
            } catch (error) {
                console.error('Error loading portfolio sparkline:', error);
            }
        },

        drawPortfolioSparkline(history) {
            const ctx = document.getElementById('portfolioSparkline');
            if (!ctx) return;
            
            if (this.portfolioChart) {
                this.portfolioChart.destroy();
            }
            
            const sortedHistory = history.reverse();
            
            this.portfolioChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedHistory.map(h => new Date(h.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Portfolio Value',
                        data: sortedHistory.map(h => h.value),
                        borderColor: 'rgba(59, 130, 246, 1)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }
    }));
});
