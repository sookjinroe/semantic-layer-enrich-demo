package com.demo.customer.domain;

import com.demo.common.annotation.PersonalInfo;
import javax.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "CUST_BASE_INFO")
public class Customer {

    @Id
    @Column(name = "CUST_NO")
    private String customerNo;

    @PersonalInfo
    @Column(name = "CUST_NM")
    private String customerName;

    @PersonalInfo
    @Column(name = "CUST_EMAIL")
    private String customerEmail;

    @PersonalInfo
    @Column(name = "CUST_TEL_NO")
    private String customerTelNo;

    @PersonalInfo
    @Column(name = "BIRTH_DT")
    private LocalDate birthDate;

    @PersonalInfo
    @Column(name = "ADDR")
    private String address;

    @Column(name = "ZIP_CD")
    private String zipCode;

    @Column(name = "JOIN_DT")
    private LocalDate joinDate;

    // getters / setters 생략
}
