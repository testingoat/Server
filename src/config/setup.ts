import AdminJS from 'adminjs';
import AdminJSFastify from '@adminjs/fastify';
import * as AdminJSMongoose from '@adminjs/mongoose';
import * as Models from '../models/index.js';
import { Monitoring } from '../models/monitoring.js';
import { dark, light, noSidebar } from '@adminjs/themes';
import { ComponentLoader } from 'adminjs';
import path from 'path';
import { fileURLToPath } from 'url';
import DeliveryConfiguration from '../models/deliveryConfiguration.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register the mongoose adapter
AdminJS.registerAdapter(AdminJSMongoose);

// Create component loader
const componentLoader = new ComponentLoader();

// Bundle custom components
// Use absolute path to src/components since ComponentLoader needs the source .tsx files
const srcComponentsPath = path.resolve(__dirname, '../../src/components/RejectDeliveryPartner');
const Components = {
    RejectDeliveryPartner: componentLoader.add('RejectDeliveryPartner', srcComponentsPath),
};

// Import the SellerProduct model
const SellerProduct = Models.Product; // Using the enhanced Product model
// Custom approve action
const approveAction = {
    actionType: 'record',
    icon: 'CheckCircle',
    label: 'Approve Product',
    variant: 'success',
    component: false,
    handler: async (request: any, response: any, context: any) => {
        const { record, resource, currentAdmin } = context;
        try {
            console.log(' Approving product:', record.id());
            // Update the product status to approved
            await record.update({
                status: 'approved',
                approvedAt: new Date(),
                rejectionReason: null
            });
            console.log('✅ Product approved and saved successfully');
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Product approved successfully!',
                    type: 'success'
                },
                redirectUrl: '/admin/resources/seller-products/actions/list'
            };
        }
        catch (error) {
            const err = error as Error;
            console.error('❌ Error approving product:', err.message, err.stack);
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Failed to approve product: ' + err.message,
                    type: 'error'
                }
            };
        }
    },
    guard: 'Are you sure you want to approve this product?'
};
// Custom reject action
const rejectAction = {
    actionType: 'record',
    icon: 'XCircle',
    label: 'Reject Product',
    variant: 'danger',
    component: false,
    handler: async (request: any, response: any, context: any) => {
        const { record, resource, currentAdmin } = context;
        try {
            console.log(' Rejecting product:', record.id());
            // Get rejection reason from request
            const rejectionReason = request.payload?.rejectionReason || 'Product rejected by admin';
            // Update the product status to rejected
            await record.update({
                status: 'rejected',
                rejectionReason: rejectionReason
            });
            console.log('✅ Product rejected and saved successfully');
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Product rejected successfully!',
                    type: 'success'
                },
                redirectUrl: '/admin/resources/seller-products/actions/list'
            };
        }
        catch (error) {
            const err = error as Error;
            console.error(' Error rejecting product:', error);
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Failed to reject product: ' + err.message,
                    type: 'error'
                }
            };
        }
    },
    guard: 'Are you sure you want to reject this product?'
};

// Custom approve action for Delivery Partners
const approveDeliveryPartnerAction = {
    actionType: 'record',
    icon: 'CheckCircle',
    label: 'Approve Delivery Partner',
    variant: 'success',
    component: false,
    handler: async (request: any, response: any, context: any) => {
        const { record, resource, currentAdmin } = context;
        try {
            console.log('🚚 Approving delivery partner:', record.id());
            // Update the delivery partner status to approved
            await record.update({
                isVerified: true,
                approvedAt: new Date(),
                approvedBy: currentAdmin?.email || 'admin',
                rejectionReason: null
            });
            console.log('✅ Delivery Partner approved and saved successfully');
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Delivery Partner approved successfully!',
                    type: 'success'
                },
                redirectUrl: '/admin/resources/DeliveryPartner/actions/list'
            };
        }
        catch (error) {
            const err = error as Error;
            console.error('❌ Error approving delivery partner:', err.message, err.stack);
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Failed to approve delivery partner: ' + err.message,
                    type: 'error'
                }
            };
        }
    },
    guard: 'Are you sure you want to approve this delivery partner?'
};

// Custom reject action for Delivery Partners
const rejectDeliveryPartnerAction = {
    actionType: 'record',
    icon: 'XCircle',
    label: 'Reject Delivery Partner',
    variant: 'danger',
    component: Components.RejectDeliveryPartner,
    handler: async (request: any, response: any, context: any) => {
        const { record, resource, currentAdmin } = context;
        try {
            console.log('🚚 Rejecting delivery partner:', record.id());
            // Get rejection reason from request
            const rejectionReason = request.payload?.rejectionReason;

            // Validate rejection reason
            if (!rejectionReason || rejectionReason.trim().length === 0) {
                return {
                    record: record.toJSON(currentAdmin),
                    notice: {
                        message: 'Rejection reason is required',
                        type: 'error'
                    }
                };
            }

            if (rejectionReason.trim().length < 10) {
                return {
                    record: record.toJSON(currentAdmin),
                    notice: {
                        message: 'Rejection reason must be at least 10 characters',
                        type: 'error'
                    }
                };
            }

            // Update the delivery partner status to rejected
            await record.update({
                isVerified: false,
                rejectionReason: rejectionReason.trim(),
                approvedAt: null,
                approvedBy: null
            });
            console.log('✅ Delivery Partner rejected and saved successfully');
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Delivery Partner rejected successfully!',
                    type: 'success'
                },
                redirectUrl: '/admin/resources/DeliveryPartner/actions/list'
            };
        }
        catch (error) {
            const err = error as Error;
            console.error('❌ Error rejecting delivery partner:', error);
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Failed to reject delivery partner: ' + err.message,
                    type: 'error'
                }
            };
        }
    }
};

// Create AdminJS instance
export const admin = new AdminJS({
    componentLoader,
    pages: {},
    dashboard: {},
    resources: [
        // Customer Management
        {
            resource: Models.Customer,
            options: {
                navigation: {
                    name: 'User Management',
                    icon: 'Users'
                },
                listProperties: ['phone', 'role', 'isActivated', 'createdAt'],
                filterProperties: ['phone', 'role', 'isActivated'],
                showProperties: ['phone', 'role', 'isActivated', 'createdAt', 'updatedAt'],
            },
        },
        // Delivery Partner Management
        {
            resource: Models.DeliveryPartner,
            options: {
                navigation: {
                    name: 'Delivery Management',
                    icon: 'Truck'
                },
                listProperties: [
                    'name', 'phone', 'email',
                    'vehicleType', 'vehicleNumber', 'drivingLicenseNumber',
                    'isVerified', 'profileCompleted', 'approvedAt', 'createdAt'
                ],
                filterProperties: [
                    'name', 'email', 'phone',
                    'isVerified', 'profileCompleted', 'isActivated',
                    'vehicleType', 'approvedBy', 'createdAt'
                ],
                showProperties: [
                    'name', 'email', 'phone', 'address', 'vehicleType', 'vehicleNumber',
                    'drivingLicenseNumber', 'bloodGroup',
                    'emergencyContact.name', 'emergencyContact.phone', 'emergencyContact.relation',
                    'bankAccountNumber', 'ifscCode', 'bankName',
                    'isVerified', 'isActivated', 'profileCompleted',
                    'approvedAt', 'approvedBy', 'rejectionReason',
                    'createdAt', 'updatedAt'
                ],
                editProperties: [
                    'name', 'email', 'phone', 'address',
                    'vehicleType', 'vehicleNumber', 'drivingLicenseNumber',
                    'bloodGroup', 'bankAccountNumber', 'ifscCode', 'bankName',
                    'emergencyContact.name', 'emergencyContact.phone', 'emergencyContact.relation',
                    'isActivated', 'rejectionReason'
                ],
                properties: {
                    isVerified: {
                        availableValues: [
                            { value: true, label: 'Approved' },
                            { value: false, label: 'Pending Approval' }
                        ],
                        isVisible: { list: true, show: true, edit: false, filter: true }
                    },
                    profileCompleted: {
                        availableValues: [
                            { value: true, label: 'Complete' },
                            { value: false, label: 'Incomplete' }
                        ],
                        isVisible: { list: true, show: true, edit: false, filter: true }
                    },
                    vehicleType: {
                        availableValues: [
                            { value: 'bike', label: 'Bike' },
                            { value: 'scooter', label: 'Scooter' },
                            { value: 'bicycle', label: 'Bicycle' },
                            { value: 'car', label: 'Car' }
                        ],
                        isVisible: { list: true, show: true, edit: true, filter: true }
                    },
                    rejectionReason: {
                        type: 'textarea',
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    approvedBy: {
                        isVisible: { list: false, show: true, edit: false, filter: true }
                    },
                    approvedAt: {
                        isVisible: { list: true, show: true, edit: false, filter: false }
                    },
                    'emergencyContact.name': {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    'emergencyContact.phone': {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    'emergencyContact.relation': {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    bankAccountNumber: {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    ifscCode: {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    bankName: {
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    }
                },
                sort: {
                    sortBy: 'createdAt',
                    direction: 'desc'
                },
                actions: {
                    approve: approveDeliveryPartnerAction,
                    reject: rejectDeliveryPartnerAction,
                },
            },
        },
        // Delivery Configuration - NEW
        {
            resource: DeliveryConfiguration,
            options: {
                navigation: {
                    name: 'Delivery Management',
                    icon: 'Truck'
                },
                listProperties: ['city', 'vehicle_type', 'base_fare', 'extra_per_km', 'surge_multiplier', 'active'],
                filterProperties: ['city', 'vehicle_type', 'active'],
                editProperties: ['city', 'vehicle_type', 'base_fare', 'base_distance', 'extra_per_km', 'surge_multiplier', 'max_delivery_distance', 'min_order_value', 'small_order_fee', 'agent_base_payout', 'agent_per_km', 'active'],
                properties: {
                    surge_multiplier: {
                        description: '⚠️ 1.0 = Normal | 1.5 = Rain/Peak | 2.0 = Emergency Only (Hard Cap)'
                    },
                    agent_base_payout: {
                        description: 'Minimum amount paid to the driver per order'
                    }
                }
            }
        },
        {
            resource: Models.HomeConfig,
            options: {
                navigation: {
                    name: 'Store Management',
                    icon: 'Layout'
                },
                listProperties: ['isActive', 'layoutVersion', 'updatedAt'],
                filterProperties: ['isActive', 'layoutVersion'],
                editProperties: ['isActive', 'layoutVersion', 'offerSections', 'bannerCarousel', 'categoryGrids'],
                showProperties: ['isActive', 'layoutVersion', 'offerSections', 'bannerCarousel', 'categoryGrids', 'createdAt', 'updatedAt'],
                properties: {
                    offerSections: {
                        description: 'Offer sections show curated products on Home (manual product IDs). Price/quantity come from Product records; edit those in Product Management.'
                    },
                    'offerSections.productIds': {
                        reference: 'Product',
                        isArray: true,
                        description: 'Select Products to show in this Offer section (ordered). Only approved + active products will render in the app.'
                    },
                    bannerCarousel: {
                        description: 'Use public image URLs (R2 recommended). Set order and isActive to control rotation.'
                    },
                    categoryGrids: {
                        description: 'Create one or more grids. Each grid has a title, order, and tiles referencing Categories. Use label/image override for seasonal tiles.'
                    }
                },
                actions: {
                    new: {
                        before: async (request: any) => {
                            if (!request.payload) return request;
                            request.payload = {
                                bannerCarousel: request.payload.bannerCarousel ?? [],
                                offerSections: request.payload.offerSections ?? [],
                                categoryGrids: request.payload.categoryGrids ?? [],
                                ...request.payload,
                            };
                            return request;
                        }
                    }
                }
            }
        },
        // Admin Management
        {
            resource: Models.Admin,
            options: {
                navigation: {
                    name: 'User Management',
                    icon: 'Users'
                },
                listProperties: ['email', 'role', 'isActivated', 'createdAt'],
                filterProperties: ['email', 'role', 'isActivated'],
                showProperties: ['email', 'role', 'isActivated', 'createdAt', 'updatedAt'],
            },
        },
        // Seller Management - NEW
        {
            resource: Models.Seller,
            options: {
                navigation: {
                    name: 'Seller Management',
                    icon: 'Store'
                },
                listProperties: ['name', 'phone', 'email', 'storeName', 'isVerified', 'profileCompleted', 'createdAt'],
                filterProperties: ['name', 'phone', 'email', 'storeName', 'isVerified', 'profileCompleted'],
                showProperties: ['name', 'phone', 'email', 'storeName', 'storeAddress', 'businessHours.open', 'businessHours.close', 'deliveryAreas', 'isVerified', 'profileCompleted', 'createdAt', 'updatedAt'],
                editProperties: ['name', 'email', 'storeName', 'storeAddress', 'businessHours.open', 'businessHours.close', 'deliveryAreas', 'isVerified', 'profileCompleted'],
            },
        },
        // Seller Products Management - NEW
        {
            resource: SellerProduct,
            options: {
                id: 'seller-products',
                navigation: {
                    name: 'Seller Management',
                    icon: 'Store'
                },
                listProperties: ['name', 'seller', 'price', 'category', 'status', 'createdAt'],
                filterProperties: ['name', 'seller', 'category', 'status'],
                showProperties: ['name', 'description', 'seller', 'price', 'quantity', 'category', 'images', 'status', 'approvedBy', 'approvedAt', 'rejectionReason', 'createdAt', 'updatedAt'],
                editProperties: ['name', 'description', 'price', 'quantity', 'category', 'images', 'status', 'rejectionReason'],
                actions: {
                    // Custom actions for approval workflow
                    approve: approveAction,
                    reject: rejectAction,
                    // Modify default actions
                    new: { isVisible: false }, // Sellers create products via app
                    edit: {
                        isVisible: (context: any) => {
                            // Only allow editing of pending/rejected products
                            const status = context.record?.params?.status;
                            return ['pending', 'rejected'].includes(status);
                        }
                    },
                    delete: {
                        isVisible: (context: any) => {
                            // Only allow deletion of pending/rejected products
                            const status = context.record?.params?.status;
                            return ['pending', 'rejected'].includes(status);
                        }
                    }
                },
                properties: {
                    seller: {
                        reference: 'Seller',
                        isVisible: { list: true, show: true, edit: false, filter: true }
                    },
                    category: {
                        reference: 'Category',
                        isVisible: { list: true, show: true, edit: true, filter: true }
                    },
                    status: {
                        availableValues: [
                            { value: 'pending', label: 'Pending Approval' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'rejected', label: 'Rejected' }
                        ],
                        isVisible: { list: true, show: true, edit: true, filter: true }
                    },
                    images: {
                        isArray: true,
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    },
                    approvedBy: {
                        isVisible: { list: false, show: true, edit: false, filter: false }
                    },
                    approvedAt: {
                        isVisible: { list: false, show: true, edit: false, filter: false }
                    },
                    rejectionReason: {
                        type: 'textarea',
                        isVisible: { list: false, show: true, edit: true, filter: false }
                    }
                }
            },
        },
        // Store Management
        {
            resource: Models.Branch,
            options: {
                navigation: {
                    name: 'Store Management',
                    icon: 'MapPin'
                }
            }
        },
        // Delivery ETA Configuration
        {
            resource: Models.DeliveryEtaConfig,
            options: {
                navigation: {
                    name: 'Store Management',
                    icon: 'Timer',
                },
                listProperties: [
                    'defaultPrepTimeMin',
                    'defaultAverageSpeedKmph',
                    'defaultServiceRadiusKm',
                    'isActive',
                    'createdBy',
                    'createdAt',
                ],
                editProperties: [
                    'defaultPrepTimeMin',
                    'defaultAverageSpeedKmph',
                    'defaultServiceRadiusKm',
                    'isActive',
                    'createdBy',
                ],
                showProperties: [
                    'defaultPrepTimeMin',
                    'defaultAverageSpeedKmph',
                    'defaultServiceRadiusKm',
                    'isActive',
                    'createdBy',
                    'createdAt',
                    'updatedAt',
                ],
                filterProperties: ['isActive', 'createdBy'],
            }
        },
        // Product Management (Approved Products)
        {
            resource: Models.Product,
            options: {
                id: 'approved-products',
                navigation: {
                    name: 'Product Management',
                    icon: 'Package'
                },
                listProperties: ['name', 'price', 'category', 'isActive', 'createdAt'],
                filterProperties: ['name', 'category', 'isActive'],
                properties: {
                    category: {
                        reference: 'Category'
                    }
                }
            }
        },
        // Internal Product resource for references (used by Order items)
        {
            resource: Models.Product,
            options: {
                id: 'Product',
                navigation: null,
                actions: {
                    new: { isVisible: false },
                    edit: { isVisible: false },
                    delete: { isVisible: false },
                },
            }
        },
        // Category Management
        {
            resource: Models.Category,
            options: {
                navigation: {
                    name: 'Product Management',
                    icon: 'Package'
                }
            }
        },
        // Order Management
        {
            resource: Models.Order,
            options: {
                navigation: {
                    name: 'Order Management',
                    icon: 'ShoppingCart'
                }
            }
        },
        // System Monitoring
        {
            resource: Monitoring,
            options: {
                navigation: {
                    name: 'System',
                    icon: 'Activity'
                },
                actions: {
                    new: { isVisible: false },
                    edit: { isVisible: false },
                    delete: { isVisible: false },
                    show: { isVisible: true },
                    list: { isVisible: true }
                }
            },
        },
        // Counter Management
        {
            resource: Models.Counter,
            options: {
                navigation: {
                    name: 'System',
                    icon: 'Activity'
                }
            }
        },
    ],
    branding: {
        companyName: 'GoatGoat Admin',
        logo: '/public/assets/logo.png',
        theme: {
            colors: {
                primary100: '#4f46e5',
                primary80: '#6366f1',
                primary60: '#8b5cf6',
                primary40: '#a78bfa',
                primary20: '#c4b5fd',
            }
        }
    },
    locale: {
        language: 'en',
        availableLanguages: ['en'],
        translations: {
            en: {
                resources: {
                    'seller-products': {
                        name: 'Seller Products',
                        actions: {
                            approve: 'Approve Product',
                            reject: 'Reject Product'
                        }
                    },
                    'approved-products': {
                        name: 'Products'
                    }
                }
            }
        }
    }
});
// Setup AdminJS with Fastify
export const setupAdminJS = async (fastify: any) => {
    try {
        console.log(' Setting up AdminJS with enhanced seller management...');
        await fastify.register(AdminJSFastify, {
            admin,
            options: {
                rootPath: '/admin',
                loginPath: '/admin/login',
                logoutPath: '/admin/logout',
            }
        });
        console.log(' AdminJS setup completed successfully');
        console.log(' Admin panel available at: /admin');
        console.log(' Seller Products tab: /admin/resources/seller-products');
        return admin;
    }
    catch (error) {
        console.error(' AdminJS setup failed:', error);
        throw error;
    }
};

export const buildAdminRouter = async (app: any) => {
    try {
        console.log('🔧 Building AdminJS router...');
        console.log('🔧 Environment:', process.env.NODE_ENV);

        // Register AdminJS router
        await AdminJSFastify.buildRouter(admin, app);
        console.log('✅ AdminJS router registered successfully');

        console.log('✅ AdminJS router built successfully - admin panel accessible at /admin');
        return admin;
    } catch (error) {
        console.error('❌ AdminJS router build failed:', error);
        throw error;
    }
};
