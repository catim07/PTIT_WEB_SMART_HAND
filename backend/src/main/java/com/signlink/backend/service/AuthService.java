package com.signlink.backend.service;

import com.signlink.backend.dto.AuthRequest;
import com.signlink.backend.dto.AuthResponse;
import com.signlink.backend.dto.RegisterRequest;
import com.signlink.backend.model.UserAccount;
import com.signlink.backend.repository.UserAccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private UserAccountRepository userAccountRepository;

    public AuthResponse register(RegisterRequest request) {
        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Email không được để trống!");
        }

        String cleanEmail = request.getEmail().trim().toLowerCase();
        if (userAccountRepository.existsByEmail(cleanEmail)) {
            throw new IllegalArgumentException("Email này đã được đăng ký tài khoản!");
        }

        String hashedPassword = hashPassword(request.getPassword());
        String role = (request.getRole() != null && request.getRole().equalsIgnoreCase("ADMIN")) ? "ADMIN" : "USER";
        String fullName = (request.getFullName() != null && !request.getFullName().trim().isEmpty()) 
            ? request.getFullName().trim() 
            : "Người Dùng SignLink";

        UserAccount user = new UserAccount(cleanEmail, hashedPassword, fullName, role);
        UserAccount saved = userAccountRepository.save(user);

        String token = generateSimpleToken(saved);
        return new AuthResponse(token, saved.getId(), saved.getEmail(), saved.getFullName(), saved.getRole());
    }

    public AuthResponse login(AuthRequest request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            throw new IllegalArgumentException("Email và mật khẩu không được để trống!");
        }

        String cleanEmail = request.getEmail().trim().toLowerCase();
        Optional<UserAccount> opt = userAccountRepository.findByEmail(cleanEmail);

        if (opt.isEmpty()) {
            throw new IllegalArgumentException("Tài khoản email không tồn tại!");
        }

        UserAccount user = opt.get();
        String hashedPassword = hashPassword(request.getPassword());

        if (!user.getPassword().equals(hashedPassword)) {
            throw new IllegalArgumentException("Mật khẩu không chính xác!");
        }

        String token = generateSimpleToken(user);
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getFullName(), user.getRole());
    }

    public UserAccount getProfile(String token) {
        if (token == null || !token.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Token không hợp lệ!");
        }

        String rawToken = token.substring(7).trim();
        String[] parts = rawToken.split(":");
        if (parts.length < 2) {
            throw new IllegalArgumentException("Token định dạng sai!");
        }

        String userId = parts[0];
        return userAccountRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người dùng!"));
    }

    public String hashPassword(String rawPassword) {
        if (rawPassword == null) return "";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawPassword.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            return rawPassword;
        }
    }

    private String generateSimpleToken(UserAccount user) {
        return user.getId() + ":" + user.getRole() + ":" + UUID.randomUUID().toString().substring(0, 8);
    }
}
