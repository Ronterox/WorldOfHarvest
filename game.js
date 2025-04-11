const possibleItems = [
    { type: 'autowaterer', name: 'Auto Waterer', description: 'Waters the plant automatically', icon: '💧', price: 50, isEnhancer: true },
    { type: 'fertilizer', name: 'Fertilizer', description: 'Increases plant growth rate', icon: '🌿', price: 75, isEnhancer: true },
    { type: 'autoseller', name: 'Auto Seller', description: 'Sells the plant above automatically', icon: '🛒', price: 100, isEnhancer: false },
    { type: 'autoseeder', name: 'Auto Seeder', description: 'Plants the seed above, below it', icon: '🌱', price: 150, isEnhancer: false },
    { type: 'automerger', name: 'Auto Merger', description: 'Merges the left with the plant on the right', icon: '🔀', price: 200, isEnhancer: false },
];

class Plant {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.growth = 0;
        this.water = 0;
        this.maxGrowth = 100;
        this.isFullyGrown = false;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.autoSold = false;  // Flag to prevent multiple auto-sells

        // Set price and growth rate based on type
        switch (type) {
            case 'carrot':
                this.price = 10;
                this.growthRate = 1;
                this.icon = '🥕';
                break;
            case 'tomato':
                this.price = 25;
                this.growthRate = 0.5;
                this.icon = '🍅';
                break;
            case 'corn':
                this.price = 55;
                this.growthRate = 0.25;
                this.icon = '🌽';
                break;
            case 'potato':
                this.price = 115;
                this.growthRate = 0.1;
                this.icon = '🥔';
                break;
            case 'pepper':
                this.price = 230;
                this.growthRate = 0.05;
                this.icon = '🌶️';
                break;
            case 'eggplant':
                this.price = 500;
                this.growthRate = 0.025;
                this.icon = '🍆';
                break;
            case 'cucumber':
                this.price = 1050;
                this.growthRate = 0.0125;
                this.icon = '🥒';
                break;
            case 'onion':
                this.price = 2150;
                this.growthRate = 0.00625;
                this.icon = '🧅';
                break;
        }

        // Calculate base time to grow in seconds
        this.baseTimeToGrow = (this.maxGrowth / (0.05 * this.growthRate)) / 60;
    }

    getTimeRemaining(cellUpgrades) {
        if (this.isFullyGrown) return 0;

        // Calculate current growth rate with bonuses
        let effectiveRate = this.growthRate;
        if (cellUpgrades.fertilizer) effectiveRate *= 2;
        if (this.water > 50) effectiveRate *= 1.5;

        // Calculate remaining growth and time
        const remainingGrowth = this.maxGrowth - this.growth;
        const secondsRemaining = (remainingGrowth / (0.05 * effectiveRate)) / 60;

        return secondsRemaining;
    }

    formatTimeRemaining(seconds) {
        if (seconds < 60) {
            return `${Math.ceil(seconds)}s`;
        } else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.ceil(seconds % 60);
            return `${minutes}m${remainingSeconds}s`;
        }
    }

    addWater() {
        if (this.water < 100) {
            this.water = Math.min(100, this.water + 25);
            soundManager.play('water');
        }
    }

    update(cellUpgrades, deltaTime) {
        if (this.water > 0 && !this.isFullyGrown) {
            // Growth is affected by water level and growth rate
            const waterBonus = this.water > 50 ? 1.5 : 1;
            let growthRate = this.growthRate;
            if (cellUpgrades.fertilizer) {
                growthRate *= 2;
            }
            this.growth += (deltaTime * 0.05 * growthRate * waterBonus);
            this.water = Math.max(0, this.water - (deltaTime * 0.02));

            if (this.growth >= this.maxGrowth) {
                this.growth = this.maxGrowth;
                this.isFullyGrown = true;
            }
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.plants = [];
        this.gridSize = 50;
        this.selectedTool = 'water';
        this.money = 0;
        this.draggedPlant = null;
        this.draggedShopItem = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.dragOverlay = document.getElementById('dragOverlay');
        this.animationOffset = 0;
        this.lastTimestamp = 0;
        this.unlockedPlants = new Set(['carrot']);
        this.mergeHint = null;
        this.sellHint = null;
        this.cellPriceHint = null;

        this.unlockedCells = new Set();
        this.cellPrice = 4;

        // Initialize grid upgrades
        this.gridUpgrades = {};

        this.rerollCost = 50;
        this.shopItems = possibleItems;
        this.boughtItems = new Set(); // Track bought items in current shop
        this.updateShopDisplay();

        this.resizeCanvas();
        this.setupEventListeners();

        // Set water button as active by default
        document.getElementById('waterBtn').style.backgroundColor = '#bbdefb';

        const gridsHor = Math.floor(this.canvas.width / this.gridSize);
        const gridsVer = Math.floor(this.canvas.height / this.gridSize);
        const marginHor = Math.floor(gridsHor / 2);
        const marginVer = Math.floor(gridsVer / 2);

        // Unlock center cells
        for (let x = marginHor * this.gridSize; x <= (gridsHor - marginHor) * this.gridSize; x += this.gridSize) {
            for (let y = marginVer * this.gridSize; y <= (gridsVer - marginVer) * this.gridSize; y += this.gridSize) {
                this.unlockedCells.add(this.getCellKey(x, y));
            }
        }

        this.gameLoop();
    }

    unlockPlant(type) {
        this.unlockedPlants.add(type);
        const seedElement = document.querySelector(`.seed[data-seed="${type}"]`);
        if (seedElement) {
            seedElement.classList.remove('locked');
            // seedElement.draggable = true;
            const unlockedPlant = new Plant(type, 0, 0);
            seedElement.textContent = `${unlockedPlant.icon} ${unlockedPlant.type}`;
        }
    }

    canMerge(plant1, plant2) {
        if (!plant1 || !plant2 || !plant1.isFullyGrown || !plant2.isFullyGrown) return false;

        if (plant1.type === plant2.type) {
            if (plant1.type === 'carrot' && this.unlockedPlants.has('carrot')) {
                return 'tomato';
            }
            if (plant1.type === 'tomato' && this.unlockedPlants.has('tomato')) {
                return 'corn';
            }
            if (plant1.type === 'corn' && this.unlockedPlants.has('corn')) {
                return 'potato';
            }
            if (plant1.type === 'potato' && this.unlockedPlants.has('potato')) {
                return 'pepper';
            }
            if (plant1.type === 'pepper' && this.unlockedPlants.has('pepper')) {
                return 'eggplant';
            }
            if (plant1.type === 'eggplant' && this.unlockedPlants.has('eggplant')) {
                return 'cucumber';
            }
            if (plant1.type === 'cucumber' && this.unlockedPlants.has('cucumber')) {
                return 'onion';
            }
        }
        return false;
    }

    showMergeHint(plant1, plant2, mergeResult) {
        // Remove any existing merge hint
        this.removeMergeHint();

        // Create merge hint element
        const hint = document.createElement('div');
        hint.className = 'merge-hint';
        hint.style.width = this.gridSize + 'px';
        hint.style.height = this.gridSize + 'px';
        hint.style.position = 'fixed'; // Change to fixed positioning

        // Calculate position relative to viewport
        const canvasRect = this.canvas.getBoundingClientRect();
        const x = canvasRect.left + plant2.x;
        const y = canvasRect.top + plant2.y;

        hint.style.left = x + 'px';
        hint.style.top = y + 'px';

        // Show the result emoji and make it more visible
        const emoji = new Plant(mergeResult, this.gridSize).icon;
        hint.innerHTML = `<span style="font-size: 32px; text-shadow: 0 0 10px gold;">${emoji}</span>`;

        // Add to the body
        document.body.appendChild(hint);
        this.mergeHint = hint;
    }

    showCellPriceHint(x, y) {
        if (this.cellPriceHint) {
            this.cellPriceHint.remove();
        }

        const hint = document.createElement('div');

        const canvasRect = this.canvas.getBoundingClientRect();

        hint.style.position = 'fixed';
        hint.style.left = canvasRect.left + x + 'px';
        hint.style.top = canvasRect.top + y + 'px';

        hint.innerHTML = `<span style="font-size: 32px; text-shadow: 0 0 10px gold;">${this.cellPrice}💰</span>`;

        // Add to the body
        document.body.appendChild(hint);
        this.cellPriceHint = hint;

    }

    removeMergeHint() {
        if (this.mergeHint) {
            this.mergeHint.remove();
            this.mergeHint = null;
        }
    }

    showSellHint(plant) {
        // Remove any existing sell hint
        this.removeSellHint();

        // Create sell hint element
        const hint = document.createElement('div');
        hint.className = 'sell-hint';
        hint.textContent = `Sell for $${plant.price}`;

        // Add to sell area
        document.getElementById('sellArea').appendChild(hint);
        this.sellHint = hint;
    }

    removeSellHint() {
        if (this.sellHint) {
            this.sellHint.remove();
            this.sellHint = null;
        }
    }

    getCellKey(x, y) {
        return `${x},${y}`;
    }

    getCellUpgrades(x, y) {
        const key = this.getCellKey(x, y);
        if (!this.gridUpgrades[key]) {
            this.gridUpgrades[key] = {
                // Cell enhancers (can stack)
                autowaterer: false,
                fertilizer: false,

                // Cell occupiers (exclusive)
                autoseller: false,
                autoseeder: false,
                automerger: false,

                seederPlantType: null
            };
        }
        return this.gridUpgrades[key];
    }

    canPlaceInCell(x, y, itemType) {
        const cellUpgrades = this.getCellUpgrades(x, y);
        const hasPlant = this.plants.some(p => p.x === x * this.gridSize && p.y === y * this.gridSize);

        // Check if item is an occupier
        const isOccupier = possibleItems.filter(item => !item.isEnhancer).map(item => item.type).includes(itemType);

        if (isOccupier) {
            // Occupiers need an empty cell
            return !hasPlant && !Object.values(cellUpgrades).some(value => value);
        } else {
            // Enhancers can stack with plants and other enhancers
            // but not with occupiers
            return !cellUpgrades.autoseller && !cellUpgrades.autoseeder && !cellUpgrades.automerger;
        }
    }

    resizeCanvas() {
        const gameArea = document.querySelector('.game-area');
        this.canvas.width = gameArea.clientWidth - 240;
        this.canvas.height = window.innerHeight - 150;
        this.cols = Math.floor(this.canvas.width / this.gridSize);
        this.rows = Math.floor(this.canvas.height / this.gridSize);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());

        const seeds = document.querySelectorAll('.seed');
        seeds.forEach(seed => {
            seed.addEventListener('dragstart', (e) => {
                if (!seed.classList.contains('locked')) {
                    e.dataTransfer.setData('seed', seed.dataset.seed);
                } else {
                    e.preventDefault();
                }
            });
        });

        // Handle seed planting and shop items
        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.gridSize) * this.gridSize;
            const y = Math.floor((e.clientY - rect.top) / this.gridSize) * this.gridSize;

            if (!this.unlockedCells.has(this.getCellKey(x, y))) return;

            if (this.draggedShopItem) {
                if (this.money >= this.draggedShopItem.price) {
                    const itemType = this.draggedShopItem.type;

                    if (this.canPlaceInCell(x / this.gridSize, y / this.gridSize, itemType)) {
                        // Mark item as bought
                        this.boughtItems.add(this.draggedShopItem.id);
                        this.updateShopDisplay();  // Update shop to show item as bought

                        this.money -= this.draggedShopItem.price;
                        document.getElementById('moneyDisplay').textContent = this.money;

                        possibleItems.forEach(item => {
                            if (item.type === itemType) item.price = Math.floor(item.price * 1.1);
                        });

                        const cellUpgrades = this.getCellUpgrades(x, y);
                        cellUpgrades[itemType] = true;

                        soundManager.play('drop');

                        // Immediately apply auto-waterer if there's a plant
                        if (itemType === 'autowaterer') {
                            const plant = this.plants.find(p => p.x === x && p.y === y);
                            if (plant && plant.water < 50) {
                                plant.water = Math.min(100, plant.water + 50);
                            }
                        }

                        // Update reroll button state
                        const rerollButton = document.getElementById('rerollShop');
                        rerollButton.disabled = this.money < this.rerollCost;
                    }
                }
                this.draggedShopItem = null;
                this.dragOverlay.classList.remove('dragging');
            } else {
                const seed = e.dataTransfer.getData('seed');
                const cellUpgrades = this.getCellUpgrades(x, y);

                // Only allow planting if cell has no occupiers
                if (seed && !cellUpgrades.autoseller && !cellUpgrades.autoseeder && !cellUpgrades.automerger &&
                    !this.plants.some(plant => plant.x === x && plant.y === y)) {
                    const newPlant = new Plant(seed, x, y);
                    this.plants.push(newPlant);
                    soundManager.play('drop');
                }
            }
        });

        // Handle plant dragging
        document.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.plants.forEach(plant => {
                if (plant.isFullyGrown &&
                    mouseX >= plant.x && mouseX <= plant.x + this.gridSize &&
                    mouseY >= plant.y && mouseY <= plant.y + this.gridSize) {
                    plant.isDragging = true;
                    plant.dragOffsetX = plant.x - mouseX;
                    plant.dragOffsetY = plant.y - mouseY;
                    this.draggedPlant = plant;
                    this.dragOverlay.classList.add('dragging');
                    soundManager.play('pickup');
                }
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedPlant) {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;

                // Check for sell area hover
                const sellArea = document.getElementById('sellArea');
                const sellAreaRect = sellArea.getBoundingClientRect();

                if (e.clientX >= sellAreaRect.left && e.clientX <= sellAreaRect.right &&
                    e.clientY >= sellAreaRect.top && e.clientY <= sellAreaRect.bottom &&
                    this.draggedPlant.isFullyGrown) {
                    sellArea.classList.add('drag-over');
                    this.showSellHint(this.draggedPlant);
                } else {
                    sellArea.classList.remove('drag-over');
                    this.removeSellHint();
                }

                // Check for merge possibilities while dragging
                const rect = this.canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / this.gridSize) * this.gridSize;
                const y = Math.floor((e.clientY - rect.top) / this.gridSize) * this.gridSize;

                const targetPlant = this.plants.find(p =>
                    p.x === x &&
                    p.y === y &&
                    p !== this.draggedPlant &&
                    p.isFullyGrown
                );

                const mergeResult = this.canMerge(this.draggedPlant, targetPlant);
                if (mergeResult) {
                    this.showMergeHint(this.draggedPlant, targetPlant, mergeResult);
                } else {
                    this.removeMergeHint();
                }

                this.dragOverlay.innerHTML = this.draggedPlant.icon;
                this.dragOverlay.style.transform = `translate(${this.mouseX - 24}px, ${this.mouseY - 24}px)`;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const x = Math.floor(e.offsetX / this.gridSize) * this.gridSize;
            const y = Math.floor(e.offsetY / this.gridSize) * this.gridSize;

            if (!this.unlockedCells.has(this.getCellKey(x, y))) {
                this.showCellPriceHint(x, y);
            } else if (this.cellPriceHint) {
                this.cellPriceHint.remove();
            }
        })

        document.addEventListener('mouseup', (e) => {
            if (this.draggedPlant) {
                const sellArea = document.getElementById('sellArea');
                sellArea.classList.remove('drag-over');
                this.removeSellHint();

                const rect = this.canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / this.gridSize) * this.gridSize;
                const y = Math.floor((e.clientY - rect.top) / this.gridSize) * this.gridSize;

                const targetPlant = this.plants.find(p =>
                    p.x === x &&
                    p.y === y &&
                    p !== this.draggedPlant &&
                    p.isFullyGrown
                );

                const mergeResult = this.canMerge(this.draggedPlant, targetPlant);
                if (mergeResult) {
                    // Remove both plants
                    this.plants = this.plants.filter(p => p !== this.draggedPlant && p !== targetPlant);

                    // Create new merged plant
                    const newPlant = new Plant(mergeResult, x, y);
                    newPlant.isFullyGrown = false;
                    newPlant.growth = 0;
                    this.plants.push(newPlant);

                    // Play merge sound
                    soundManager.play('merge');

                    // Unlock the new plant type if it's not already unlocked
                    if (!this.unlockedPlants.has(mergeResult)) {
                        this.unlockPlant(mergeResult);
                    }
                } else {
                    const sellArea = document.getElementById('sellArea');
                    const sellAreaRect = sellArea.getBoundingClientRect();

                    if (e.clientX >= sellAreaRect.left && e.clientX <= sellAreaRect.right &&
                        e.clientY >= sellAreaRect.top && e.clientY <= sellAreaRect.bottom &&
                        this.draggedPlant.isFullyGrown) {
                        this.sellPlant(this.draggedPlant);
                        soundManager.play('sell');
                    } else {
                        // Play drop sound if not selling or merging
                        soundManager.play('drop');
                    }
                }

                this.draggedPlant.isDragging = false;
                this.draggedPlant = null;
                this.dragOverlay.classList.remove('dragging');
                this.removeMergeHint();
            }
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.gridSize) * this.gridSize;
            const y = Math.floor((e.clientY - rect.top) / this.gridSize) * this.gridSize;

            const cellkey = this.getCellKey(x, y);
            if (!this.unlockedCells.has(cellkey) && this.cellPrice <= this.money) {
                this.unlockedCells.add(cellkey);
                this.money -= this.cellPrice;

                // Play sell sound
                soundManager.play('sell');

                // Show floating money text
                this.showFloatingText(`-$${this.cellPrice}`, x + this.gridSize / 2, y + this.gridSize / 2, 'red');
                this.cellPrice = Math.floor(this.cellPrice * 1.5);
            }

            if (this.selectedTool === 'water' && this.unlockedCells.has(cellkey)) {
                const plant = this.plants.find(p => p.x === x && p.y === y);
                if (plant) plant.addWater();
            }
        });

        const sellArea = document.getElementById('sellArea');
        sellArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            sellArea.classList.add('drag-over');
        });

        sellArea.addEventListener('dragleave', () => {
            sellArea.classList.remove('drag-over');
        });

        const shopItems = document.querySelectorAll('.shop-item');
        shopItems.forEach(item => {
            this.addDragListeners(item);
        });

        document.getElementById('waterBtn').addEventListener('click', () => {
            this.selectedTool = this.selectedTool === 'water' ? null : 'water';
            document.getElementById('waterBtn').style.backgroundColor =
                this.selectedTool === 'water' ? '#bbdefb' : '#e3f2fd';
        });

        document.getElementById('rerollShop').addEventListener('click', () => this.rerollShop());
    }

    addDragListeners(itemDiv) {
        itemDiv.addEventListener('dragstart', (e) => {
            // Check if item was already bought
            const itemId = e.target.dataset.id;
            if (this.boughtItems.has(itemId)) {
                e.preventDefault();
                return;
            }

            if (this.money >= parseInt(e.target.dataset.price)) {
                const item = {
                    id: itemId,
                    type: e.target.dataset.item.replace('-', ''),
                    price: parseInt(e.target.dataset.price),
                    name: e.target.dataset.name,
                };
                this.draggedShopItem = item;

                // Show visual feedback
                const icon = e.target.querySelector('.item-icon').textContent;
                this.dragOverlay.innerHTML = icon;
                this.dragOverlay.classList.add('dragging');
            } else {
                e.preventDefault();
            }
        });

        itemDiv.addEventListener('dragend', () => {
            this.draggedShopItem = null;
            this.dragOverlay.classList.remove('dragging');
        });
    }

    initializeShop() {
        // Generate 3 random items
        this.shopItems = [];
        for (let i = 0; i < Math.max(Math.floor(Math.random() * possibleItems.length), 3); i++) {
            const randomItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
            this.shopItems.push({ ...randomItem });
        }

        this.updateShopDisplay();
    }

    updateShopDisplay() {
        const shopContainer = document.getElementById('shopItems');
        shopContainer.innerHTML = '';

        this.shopItems.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            const itemId = `shop-item-${index}`;

            itemDiv.className = `shop-item ${item.isEnhancer ? 'enhancer' : 'occupier'}`;
            if (this.boughtItems.has(itemId)) {
                itemDiv.classList.add('bought');
            }

            itemDiv.draggable = !this.boughtItems.has(itemId);
            itemDiv.dataset.id = itemId;
            itemDiv.dataset.item = item.type;
            itemDiv.dataset.price = item.price;
            itemDiv.dataset.name = item.name;
            itemDiv.dataset.description = item.description;

            const iconDiv = document.createElement('div');
            iconDiv.className = 'item-icon';
            iconDiv.textContent = item.icon;

            itemDiv.appendChild(iconDiv);
            shopContainer.appendChild(itemDiv);

            // Re-add drag event listeners
            this.addDragListeners(itemDiv);
        });

        // Update reroll button text
        const rerollButton = document.getElementById('rerollShop');
        rerollButton.textContent = `Reroll Shop (💰${this.rerollCost})`;
        rerollButton.disabled = this.money < this.rerollCost;
    }

    rerollShop() {
        if (this.money >= this.rerollCost) {
            this.money -= this.rerollCost;
            document.getElementById('moneyDisplay').textContent = this.money;

            // Increase reroll cost by 10%
            this.rerollCost = Math.ceil(this.rerollCost * 1.1);

            // Clear bought items for new shop
            this.boughtItems.clear();

            // Generate new shop items
            this.initializeShop();

            soundManager.play('drop');
        }
    }

    sellPlant(plant) {
        this.money += plant.price;
        document.getElementById('moneyDisplay').textContent = this.money;
        this.plants = this.plants.filter(p => p !== plant);
    }

    drawGridAndUpgrades() {
        // Draw grid lines
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw cell upgrades
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            for (let y = 0; y < this.canvas.height; y += this.gridSize) {
                const upgrades = this.getCellUpgrades(x, y);
                if (Object.values(upgrades).some(value => value)) {
                    // Draw cell background
                    this.ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                }
            }
        }
    }

    drawPlants() {
        this.plants.filter(plant => !plant.isDragging).forEach(plant => {
            // Draw soil
            this.ctx.fillStyle = '#8b4513';
            this.ctx.fillRect(plant.x, plant.y, this.gridSize, this.gridSize);

            // Draw water level as background
            if (plant.water > 0) {
                this.ctx.fillStyle = `rgba(0, 119, 190, ${plant.water / 100})`;
                this.ctx.fillRect(plant.x, plant.y, this.gridSize, this.gridSize);
            }

            // Draw plant emoji
            this.drawPlantEmoji(plant);
        });
    }

    drawItemIndicator(emoji, x, y) {
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(emoji, x, y);
    }

    drawPlantEmoji(plant) {
        const emoji = plant.icon;
        this.ctx.font = `${Math.floor(20 + (plant.growth / 100) * 20)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (plant.isFullyGrown) {
            // Pulsing glow effect
            const glowIntensity = Math.abs(Math.sin(this.animationOffset * 0.003)) * 15;
            this.ctx.shadowColor = 'gold';
            this.ctx.shadowBlur = 5 + glowIntensity;

            // Bouncing and scaling animation
            const bounceOffset = Math.sin(this.animationOffset * 0.005) * 8;
            const scale = 1 + Math.sin(this.animationOffset * 0.005) * 0.1;

            // Save context state
            this.ctx.save();

            // Apply scaling transformation
            this.ctx.translate(plant.x + this.gridSize / 2, plant.y + this.gridSize / 2 + bounceOffset);
            this.ctx.scale(scale, scale);

            // Draw the emoji
            this.ctx.fillText(emoji, 0, 0);

            // Restore context state
            this.ctx.restore();
        } else {
            // Draw plant emoji
            this.ctx.fillText(emoji,
                plant.x + this.gridSize / 2,
                plant.y + this.gridSize / 2);

            // Draw time remaining if plant is growing
            if (plant.water > 0) {
                const cellUpgrades = this.getCellUpgrades(plant.x, plant.y);
                const timeRemaining = plant.getTimeRemaining(cellUpgrades);

                this.ctx.font = '12px Arial';
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 3;

                const text = plant.formatTimeRemaining(timeRemaining);
                const textY = plant.y + this.gridSize - 5;

                // Draw text stroke
                this.ctx.strokeText(text, plant.x + this.gridSize / 2, textY);
                // Draw text fill
                this.ctx.fillText(text, plant.x + this.gridSize / 2, textY);
            }
        }

        this.ctx.shadowBlur = 0;
    }

    update(deltaTime) {
        this.plants.forEach((plant, index) => {
            if (!this.unlockedCells.has(this.getCellKey(plant.x, plant.y))) return;

            const cellUpgrades = this.getCellUpgrades(plant.x, plant.y);
            plant.update(cellUpgrades, deltaTime);

            // Auto water if the cell has an auto waterer
            if (cellUpgrades.autowaterer && plant.water < 50) {
                plant.addWater();
            }

            // Check for auto-seeder below
            const cellBelow = this.getCellUpgrades(plant.x, plant.y + this.gridSize);
            if (cellBelow && cellBelow.autoseeder) {
                const plantAbove = plant;
                const plantBelow = this.plants.find(p => p.x === plant.x && p.y === plant.y + this.gridSize * 2);

                if (plantAbove && !plantBelow) {
                    cellUpgrades.seederPlantType = plantAbove.type;
                    const newPlant = new Plant(plantAbove.type, plant.x, plant.y + this.gridSize * 2);
                    this.plants.push(newPlant);
                    soundManager.play('drop');
                } else if (!plantAbove) {
                    cellUpgrades.seederPlantType = null;
                }
            }

            const cellRight = this.getCellUpgrades(plant.x + this.gridSize, plant.y);
            if (cellRight && cellRight.automerger) {
                const plantRight = this.plants.find(p => p.x === plant.x + this.gridSize * 2 && p.y === plant.y);

                const mergeResult = this.canMerge(plant, plantRight);
                if (mergeResult) {
                    // Remove both plants
                    this.plants = this.plants.filter(p => p !== plant && p !== plantRight);

                    // Create new merged plant
                    const newPlant = new Plant(mergeResult, plant.x + this.gridSize * 2, plant.y);
                    newPlant.isFullyGrown = false;
                    newPlant.growth = 0;
                    this.plants.push(newPlant);

                    // Play merge sound
                    soundManager.play('merge');

                    // Unlock the new plant type if it's not already unlocked
                    if (!this.unlockedPlants.has(mergeResult)) {
                        this.unlockPlant(mergeResult);
                    }
                }
            }

            // Auto sell if the cell below has an auto seller
            if (plant.isFullyGrown && !plant.autoSold) {
                const cellBelow = this.getCellUpgrades(plant.x, plant.y + this.gridSize);
                if (cellBelow && cellBelow.autoseller) {
                    // Add money
                    this.money += plant.price;
                    document.getElementById('moneyDisplay').textContent = this.money;

                    // Play sell sound
                    soundManager.play('sell');

                    // Remove the plant
                    this.plants.splice(index, 1);

                    // Show floating money text
                    this.showFloatingText(`+$${plant.price}`, plant.x + this.gridSize / 2, plant.y);

                    // Mark as auto-sold to prevent multiple sells
                    plant.autoSold = true;
                }
            }
        });

        // Update money display
        document.getElementById('moneyDisplay').textContent = this.money;

        // Update reroll button state
        const rerollButton = document.getElementById('rerollShop');
        rerollButton.disabled = this.money < this.rerollCost;
    }

    showFloatingText(text, x, y, color = 'green') {
        const floatingText = document.createElement('div');
        floatingText.className = 'floating-text';
        floatingText.textContent = text;
        floatingText.style.color = color;
        floatingText.style.left = x + 'px';
        floatingText.style.top = y + 'px';

        document.body.appendChild(floatingText);

        // Animate and remove
        setTimeout(() => { floatingText.remove(); }, 1000);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;

        // Draw grid lines
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw upgraded cells background and occupiers
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            for (let y = 0; y < this.canvas.height; y += this.gridSize) {
                const upgrades = this.getCellUpgrades(x, y);

                // Draw cell background for any upgrade
                if (upgrades.autowaterer || upgrades.fertilizer || upgrades.autoseller || upgrades.autoseeder || upgrades.automerger) {
                    this.ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                } else if (!this.unlockedCells.has(this.getCellKey(x, y))) {
                    this.ctx.fillStyle = 'rgb(200, 200, 200, 0.4)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);
                    this.ctx.font = '1.2rem Arial';
                    this.ctx.fillText(`🔒`, x + this.gridSize * 0.3, y + this.gridSize * 0.6);
                }

                // Draw water fill if there's a plant in this cell
                const plant = this.plants.find(p => p.x === x && p.y === y);
                if (plant && plant.water > 0) {
                    const waterHeight = (plant.water / 100) * this.gridSize;
                    this.ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
                    this.ctx.fillRect(x, y + this.gridSize - waterHeight, this.gridSize, waterHeight);
                }

                // Draw auto-waterer indicators
                if (upgrades.autowaterer) {
                    this.ctx.font = '14px Arial';
                    this.ctx.fillStyle = '#2196f3';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';

                    // Draw water drops in corners
                    this.ctx.fillText('💧', x + 15, y + 15);
                    this.ctx.fillText('💧', x + this.gridSize - 15, y + 15);
                    this.ctx.fillText('💧', x + 15, y + this.gridSize - 15);
                    this.ctx.fillText('💧', x + this.gridSize - 15, y + this.gridSize - 15);
                }

                // Draw enhancer indicators
                if (upgrades.fertilizer) {
                    this.ctx.fillStyle = '#4caf50';
                    this.drawItemIndicator('🌿', x + 15, y + 15);
                }

                // Draw occupiers (they fill the whole cell)
                if (upgrades.autoseller || upgrades.autoseeder || upgrades.automerger) {
                    this.ctx.fillStyle = 'rgba(232, 245, 233, 0.8)';
                    this.ctx.fillRect(x, y, this.gridSize, this.gridSize);

                    this.ctx.font = '40px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    const icon = upgrades.autoseller ? '🛒' : upgrades.automerger ? '🔀' : '🌱';
                    this.ctx.fillText(icon, x + this.gridSize / 2, y + this.gridSize / 2);

                    if (upgrades.autoseeder && upgrades.seederPlantType) {
                        this.ctx.font = '16px Arial';
                        const previewEmoji = new Plant(upgrades.seederPlantType, 0, 0).icon;
                        this.ctx.fillText(previewEmoji, x + this.gridSize - 15, y + 15);
                    }
                }
            }
        }

        // Draw plants
        this.plants.forEach(plant => {
            const upgrades = this.getCellUpgrades(plant.x, plant.y);

            // Draw plant with full opacity
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.font = '32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Add bounce effect for fully grown plants
            let yOffset = 0;
            if (plant.isFullyGrown) {
                yOffset = Math.sin(Date.now() / 200) * 3;
            }

            const emoji = plant.icon;
            this.ctx.fillText(emoji, plant.x + this.gridSize / 2, plant.y + this.gridSize / 2 + yOffset);

            // Draw growth progress
            if (!plant.isFullyGrown) {
                // Growth bar background
                this.ctx.fillStyle = '#f5f5f5';
                this.ctx.fillRect(plant.x + 5, plant.y + 5, this.gridSize - 10, 5);

                // Growth bar fill
                this.ctx.fillStyle = '#4CAF50';
                this.ctx.fillRect(
                    plant.x + 5,
                    plant.y + 5,
                    (this.gridSize - 10) * (plant.growth / plant.maxGrowth),
                    5
                );
            }

            // Draw time remaining if plant is growing
            if (plant.water > 0 && !plant.isFullyGrown) {
                const timeRemaining = plant.getTimeRemaining(upgrades);
                const text = plant.formatTimeRemaining(timeRemaining);

                this.ctx.font = '12px Arial';
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 3;
                this.ctx.textAlign = 'center';

                // Draw text stroke
                this.ctx.strokeText(text, plant.x + this.gridSize / 2, plant.y + this.gridSize - 5);
                // Draw text fill
                this.ctx.fillText(text, plant.x + this.gridSize / 2, plant.y + this.gridSize - 5);
            }
        });
    }

    gameLoop(timestamp = 0) {
        // Update animation offset
        const deltaTime = timestamp - this.lastTimestamp;
        this.animationOffset += deltaTime;
        this.lastTimestamp = timestamp;

        this.update(deltaTime);
        this.draw();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}
