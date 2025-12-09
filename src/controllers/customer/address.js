import mongoose from 'mongoose';
import { Customer } from '../../models/user.js';

const MAX_ADDRESSES = 5;

const sanitizeAddressPayload = (payload = {}) => {
    const {
        label = 'Home',
        houseNumber,
        street,
        landmark,
        city,
        state,
        pincode,
        latitude,
        longitude,
        isDefault = false,
    } = payload;

    return {
        label: label?.trim() || 'Home',
        houseNumber: houseNumber?.trim(),
        street: street?.trim(),
        landmark: landmark?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        pincode: pincode?.trim(),
        latitude,
        longitude,
        isDefault: Boolean(isDefault),
    };
};

const serializeAddresses = (addresses = []) => {
    const sorted = [...addresses].sort((a, b) => (b.isDefault === true) - (a.isDefault === true));
    return sorted.map((addr) => ({
        _id: addr._id,
        label: addr.label,
        houseNumber: addr.houseNumber,
        street: addr.street,
        landmark: addr.landmark,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        latitude: addr.latitude,
        longitude: addr.longitude,
        isDefault: addr.isDefault,
        createdAt: addr.createdAt,
        updatedAt: addr.updatedAt,
    }));
};

const getCustomer = async (userId, reply) => {
    const customer = await Customer.findById(userId);
    if (!customer) {
        reply.status(404).send({ message: 'Customer not found' });
        return null;
    }
    return customer;
};

export const listAddresses = async (req, reply) => {
    const { userId } = req.user;
    const customer = await getCustomer(userId, reply);
    if (!customer)
        return;
    return reply.send({ addresses: serializeAddresses(customer.addresses || []) });
};

export const createAddress = async (req, reply) => {
    const { userId } = req.user;
    const payload = sanitizeAddressPayload(req.body);
    if (!payload.houseNumber || !payload.street || !payload.city || payload.latitude === undefined || payload.longitude === undefined) {
        return reply.status(400).send({ message: 'House number, street, city, latitude, and longitude are required' });
    }
    const customer = await getCustomer(userId, reply);
    if (!customer)
        return;
    if ((customer.addresses || []).length >= MAX_ADDRESSES) {
        return reply.status(400).send({ message: `You can only save up to ${MAX_ADDRESSES} addresses.` });
    }
    const address = {
        _id: new mongoose.Types.ObjectId(),
        ...payload,
        city: payload.city?.toUpperCase(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    if (payload.isDefault || !(customer.addresses || []).some((addr) => addr.isDefault)) {
        customer.addresses.forEach((addr) => {
            addr.isDefault = false;
        });
        address.isDefault = true;
    }
    customer.addresses.push(address);
    await customer.save();
    return reply.status(201).send({ addresses: serializeAddresses(customer.addresses || []) });
};

export const updateAddress = async (req, reply) => {
    const { userId } = req.user;
    const { addressId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return reply.status(400).send({ message: 'Invalid address id' });
    }
    const payload = sanitizeAddressPayload(req.body);
    const customer = await getCustomer(userId, reply);
    if (!customer)
        return;
    const address = customer.addresses.id(addressId);
    if (!address) {
        return reply.status(404).send({ message: 'Address not found' });
    }
    Object.assign(address, {
        label: payload.label,
        houseNumber: payload.houseNumber ?? address.houseNumber,
        street: payload.street ?? address.street,
        landmark: payload.landmark,
        city: payload.city ? payload.city.toUpperCase() : address.city,
        state: payload.state ?? address.state,
        pincode: payload.pincode ?? address.pincode,
        latitude: payload.latitude ?? address.latitude,
        longitude: payload.longitude ?? address.longitude,
        updatedAt: new Date(),
    });
    if (payload.isDefault) {
        customer.addresses.forEach((addr) => {
            addr.isDefault = addr._id.toString() === addressId;
        });
    }
    await customer.save();
    return reply.send({ addresses: serializeAddresses(customer.addresses || []) });
};

export const deleteAddress = async (req, reply) => {
    const { userId } = req.user;
    const { addressId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return reply.status(400).send({ message: 'Invalid address id' });
    }
    const customer = await getCustomer(userId, reply);
    if (!customer)
        return;
    const address = customer.addresses.id(addressId);
    if (!address) {
        return reply.status(404).send({ message: 'Address not found' });
    }
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && customer.addresses.length > 0) {
        customer.addresses[0].isDefault = true;
    }
    await customer.save();
    return reply.send({ addresses: serializeAddresses(customer.addresses || []) });
};

export const setDefaultAddress = async (req, reply) => {
    const { userId } = req.user;
    const { addressId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return reply.status(400).send({ message: 'Invalid address id' });
    }
    const customer = await getCustomer(userId, reply);
    if (!customer)
        return;
    const address = customer.addresses.id(addressId);
    if (!address) {
        return reply.status(404).send({ message: 'Address not found' });
    }
    customer.addresses.forEach((addr) => {
        addr.isDefault = addr._id.toString() === addressId;
    });
    await customer.save();
    return reply.send({ addresses: serializeAddresses(customer.addresses || []) });
};
