import AdminJS from 'adminjs';
import AdminJSFastify from '@adminjs/fastify';
import * as AdminJSMongoose from '@adminjs/mongoose';
import * as Models from '../models/index.js';
import { Monitoring } from '../models/monitoring.js';
import { dark, light, noSidebar } from '@adminjs/themes';
// Register the mongoose adapter
AdminJS.registerAdapter(AdminJSMongoose);
// Import the SellerProduct model
const SellerProduct = Models.Product; // Using the enhanced Product model
// Custom approve action
const approveAction = {
    actionType: 'record',
    icon: 'CheckCircle',
    label: 'Approve Product',
    variant: 'success',
    component: false,
    handler: async (request, response, context) => {
        const { record, resource, currentAdmin } = context;
        try {
            console.log(' Approving product:', record.id());
            // Update the product status to approved
            await record.update({
                status: 'approved',
                approvedBy: currentAdmin?.id || 'admin',
                approvedAt: new Date(),
                rejectionReason: null
            });
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Product approved successfully!',
                    type: 'success'
                },
                redirectUrl: resource.href({ resourceId: resource.id() })
            };
        }
        catch (error) {
            console.error(' Error approving product:', error);
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Failed to approve product: ' + error.message,
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
    handler: async (request, response, context) => {
        const { record, resource, currentAdmin } = context;
        try {
            console.log(' Rejecting product:', record.id());
            // Get rejection reason from request
            const rejectionReason = request.payload?.rejectionReason || 'Product rejected by admin';
            // Update the product status to rejected
            await record.update({
                status: 'rejected',
                approvedBy: currentAdmin?.id || 'admin',
                approvedAt: new Date(),
                rejectionReason: rejectionReason
            });
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Product rejected successfully!',
                    type: 'success'
                },
                redirectUrl: resource.href({ resourceId: resource.id() })
            };
        }
        catch (error) {
            console.error(' Error rejecting product:', error);
            return {
                record: record.toJSON(currentAdmin),
                notice: {
                    message: 'Failed to reject product: ' + error.message,
                    type: 'error'
                }
            };
        }
    },
    guard: 'Are you sure you want to reject this product?'
};
// Create AdminJS instance
export const admin = new AdminJS({
    componentLoader: undefined,
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
                    name: 'User Management',
                    icon: 'Users'
                },
                listProperties: ['email', 'role', 'isActivated', 'createdAt'],
                filterProperties: ['email', 'role', 'isActivated'],
                showProperties: ['email', 'role', 'isActivated', 'createdAt', 'updatedAt'],
            },
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
                showProperties: ['name', 'phone', 'email', 'storeName', 'storeAddress', 'businessHours', 'deliveryAreas', 'isVerified', 'profileCompleted', 'createdAt', 'updatedAt'],
                editProperties: ['name', 'email', 'storeName', 'storeAddress', 'businessHours', 'deliveryAreas', 'isVerified', 'profileCompleted'],
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
                        isVisible: (context) => {
                            // Only allow editing of pending/rejected products
                            const status = context.record?.params?.status;
                            return ['pending', 'rejected'].includes(status);
                        }
                    },
                    delete: {
                        isVisible: (context) => {
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
        logo: false,
        softwareBrothers: false,
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
export const setupAdminJS = async (fastify) => {
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
